import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcularEstadoProducto, InventoryMovement } from './inventory-utils';
import { fmt, round2 } from '@/accounting/utils';
import { InventoryLot, simularSalidaFifo } from './fifo-utils';

interface CostLine {
  accountId: string;
  amount: number;
}

interface InventoryExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  journalEntryId: string;
  journalDate: string;
  costLines: CostLine[];
  onSave: (totalCosto: number) => void;
}

interface ExitLine {
  productId: string;
  cantidad: string;
}

interface ProductOption {
  id: string;
  nombre: string;
  codigo: string;
  metodo_valuacion: 'CPP' | 'FIFO';
}

export function InventoryExitModal({ isOpen, onClose, journalEntryId, journalDate, costLines, onSave }: InventoryExitModalProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [allLots, setAllLots] = useState<InventoryLot[]>([]);
  const [exitLines, setExitLines] = useState<ExitLine[]>([{ productId: '', cantidad: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prods } = await supabase
      .from('products')
      .select('id, nombre, codigo, metodo_valuacion')
      .eq('user_id', user.id)
      .eq('is_active', true);
    setProducts((prods || []).map(p => ({
      ...p,
      metodo_valuacion: (p.metodo_valuacion as 'CPP' | 'FIFO') || 'CPP',
    })));

    const { data: movs } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('user_id', user.id);
    setAllMovements((movs || []) as InventoryMovement[]);

    const { data: lots } = await supabase
      .from('inventory_lots')
      .select('*')
      .eq('user_id', user.id)
      .gt('cantidad_disponible', 0)
      .order('fecha_ingreso', { ascending: true });
    setAllLots((lots || []) as InventoryLot[]);
  }

  function addLine() {
    setExitLines([...exitLines, { productId: '', cantidad: '' }]);
  }

  function updateLine(idx: number, field: keyof ExitLine, value: string) {
    const updated = [...exitLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setExitLines(updated);
  }

  function removeLine(idx: number) {
    if (exitLines.length <= 1) return;
    setExitLines(exitLines.filter((_, i) => i !== idx));
  }

  // Calculate cost preview for each line based on product's method
  const linesPreviews = useMemo(() => {
    return exitLines.map(line => {
      if (!line.productId) return { cu: 0, ct: 0, metodo: 'CPP' as const, fifoDisponible: 0 };
      const qty = parseFloat(line.cantidad) || 0;
      const prod = products.find(p => p.id === line.productId);
      const metodo = prod?.metodo_valuacion || 'CPP';

      const productMovements = allMovements
        .filter(m => m.product_id === line.productId && m.fecha <= journalDate);
      const state = calcularEstadoProducto(productMovements);

      const productLots = allLots.filter(l => l.product_id === line.productId);
      const fifoDisponible = productLots.reduce((s, l) => s + l.cantidad_disponible, 0);

      // For FIFO preview, use cost of oldest lot
      const cu = metodo === 'FIFO' && productLots.length > 0
        ? productLots.sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso))[0].costo_unitario
        : state.costoUnitario;

      return { cu, ct: round2(qty * cu), metodo, fifoDisponible };
    });
  }, [exitLines, allMovements, allLots, journalDate, products]);

  const totalCosto = round2(linesPreviews.reduce((s, l) => s + l.ct, 0));

  async function handleSave() {
    const validLines = exitLines.filter(l => l.productId && parseFloat(l.cantidad) > 0);
    if (validLines.length === 0) { toast.error('Agrega al menos una línea'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let costoAcumulado = 0;

      for (const line of validLines) {
        const qty = parseFloat(line.cantidad);
        const prod = products.find(p => p.id === line.productId);
        const metodo = prod?.metodo_valuacion || 'CPP';

        if (metodo === 'CPP') {
          // ── CPP: costo promedio ponderado ──────────────────────────────
          const productMovements = allMovements
            .filter(m => m.product_id === line.productId && m.fecha <= journalDate);
          const state = calcularEstadoProducto(productMovements);
          const cu = state.costoUnitario;
          const ct = round2(qty * cu);
          costoAcumulado = round2(costoAcumulado + ct);

          const { error } = await supabase.from('inventory_movements').insert({
            product_id: line.productId,
            fecha: journalDate,
            tipo: 'SALIDA',
            cantidad: qty,
            costo_unitario: cu,
            costo_total: ct,
            metodo_valuacion: 'CPP',
            referencia: journalEntryId,
            journal_entry_id: journalEntryId,
            user_id: user.id,
          });
          if (error) throw error;

        } else {
          // ── FIFO: primera entrada, primera salida ──────────────────────
          const productLots = allLots
            .filter(l => l.product_id === line.productId && l.cantidad_disponible > 0)
            .sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso));

          const fifoDisponible = productLots.reduce((s, l) => s + l.cantidad_disponible, 0);
          if (fifoDisponible < qty) {
            throw new Error(`Stock FIFO insuficiente para "${prod?.nombre}": disponible ${fifoDisponible}, solicitado ${qty}`);
          }

          let fifoLines;
          try { fifoLines = simularSalidaFifo(productLots, qty); }
          catch (e: any) { throw new Error(`Error FIFO para "${prod?.nombre}": ${e.message}`); }

          let costoProducto = 0;
          for (const fifoLine of fifoLines) {
            const nuevaDisponible = round2(fifoLine.lot.cantidad_disponible - fifoLine.cantidad);

            const { error: lotErr } = await supabase
              .from('inventory_lots')
              .update({ cantidad_disponible: nuevaDisponible })
              .eq('id', fifoLine.lot.id);
            if (lotErr) throw lotErr;

            const { error: movErr } = await supabase.from('inventory_movements').insert({
              product_id: line.productId,
              inventory_lot_id: fifoLine.lot.id,
              fecha: journalDate,
              tipo: 'SALIDA',
              cantidad: fifoLine.cantidad,
              costo_unitario: fifoLine.lot.costo_unitario,
              costo_total: fifoLine.costo_total,
              metodo_valuacion: 'FIFO',
              referencia: journalEntryId,
              journal_entry_id: journalEntryId,
              user_id: user.id,
            });
            if (movErr) throw movErr;
            costoProducto = round2(costoProducto + fifoLine.costo_total);
          }
          costoAcumulado = round2(costoAcumulado + costoProducto);
        }
      }

      toast.success(`Salidas registradas — Costo total: ${fmt(costoAcumulado)}`);
      onSave(costoAcumulado);
      setExitLines([{ productId: '', cantidad: '' }]);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar salidas');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar salida de inventario</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Se detectó un asiento con costo de ventas. El método (CPP o FIFO) se aplica automáticamente según cada producto.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {exitLines.map((line, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Producto</Label>
                  <Select value={line.productId} onValueChange={v => updateLine(idx, 'productId', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo} — {p.nombre}
                          <span className="ml-2 text-xs text-muted-foreground">({p.metodo_valuacion})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min="0" value={line.cantidad} onChange={e => updateLine(idx, 'cantidad', e.target.value)} />
                </div>
                {exitLines.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>×</Button>
                )}
              </div>
              {line.productId && linesPreviews[idx]?.cu > 0 && parseFloat(line.cantidad) > 0 && (
                <div className="text-xs text-muted-foreground pl-1 space-y-0.5">
                  <p>
                    <span className="font-medium">{linesPreviews[idx].metodo}</span>
                    {' — '}C.U.: {fmt(linesPreviews[idx].cu)} → Costo: {fmt(linesPreviews[idx].ct)}
                  </p>
                  {linesPreviews[idx].metodo === 'FIFO' && (
                    <p>Stock FIFO disponible: {fmt(linesPreviews[idx].fifoDisponible)} unidades</p>
                  )}
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLine}>+ Agregar línea</Button>
          {totalCosto > 0 && (
            <div className="text-sm font-medium text-right border-t pt-2">
              Costo total estimado: <span className="text-primary">{fmt(totalCosto)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Omitir</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar salidas'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CostLine {
  accountId: string;
  amount: number;
}

interface InventoryExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  journalEntryId: string;
  journalDate: string;
  costLines: CostLine[];
  onSave: (totalCosto: number) => void;
}

interface ExitLine {
  productId: string;
  cantidad: string;
}

interface ProductOption {
  id: string;
  nombre: string;
  codigo: string;
}

export function InventoryExitModal({ isOpen, onClose, journalEntryId, journalDate, costLines, onSave }: InventoryExitModalProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [exitLines, setExitLines] = useState<ExitLine[]>([{ productId: '', cantidad: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadProducts();
  }, [isOpen]);

  async function loadProducts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prods } = await supabase
      .from('products')
      .select('id, nombre, codigo')
      .eq('user_id', user.id)
      .eq('is_active', true);
    setProducts(prods || []);

    const { data: movs } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('user_id', user.id);
    setAllMovements((movs || []) as InventoryMovement[]);
  }

  function addLine() {
    setExitLines([...exitLines, { productId: '', cantidad: '' }]);
  }

  function updateLine(idx: number, field: keyof ExitLine, value: string) {
    const updated = [...exitLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setExitLines(updated);
  }

  function removeLine(idx: number) {
    if (exitLines.length <= 1) return;
    setExitLines(exitLines.filter((_, i) => i !== idx));
  }

  // Calculate cost preview for each line
  const linesPreviews = useMemo(() => {
    return exitLines.map(line => {
      if (!line.productId) return { cu: 0, ct: 0 };
      const qty = parseFloat(line.cantidad) || 0;
      // Filter movements for this product only, up to the journal date
      const productMovements = allMovements
        .filter(m => m.product_id === line.productId && m.fecha <= journalDate);
      const state = calcularEstadoProducto(productMovements);
      const cu = state.costoUnitario;
      return { cu, ct: qty * cu };
    });
  }, [exitLines, allMovements, journalDate]);

  const totalCosto = linesPreviews.reduce((s, l) => s + l.ct, 0);

  async function handleSave() {
    const validLines = exitLines.filter(l => l.productId && parseFloat(l.cantidad) > 0);
    if (validLines.length === 0) { toast.error('Agrega al menos una línea'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let costoAcumulado = 0;

      for (const line of validLines) {
        const qty = parseFloat(line.cantidad);
        // Use movements up to journal date for accurate CPP
        const productMovements = allMovements
          .filter(m => m.product_id === line.productId && m.fecha <= journalDate);
        const state = calcularEstadoProducto(productMovements);
        const cu = state.costoUnitario;
        const ct = qty * cu;
        costoAcumulado += ct;

        const { error } = await supabase.from('inventory_movements').insert({
          product_id: line.productId,
          fecha: journalDate,
          tipo: 'SALIDA',
          cantidad: qty,
          costo_unitario: cu,
          costo_total: ct,
          metodo_valuacion: 'CPP',
          referencia: journalEntryId,
          journal_entry_id: journalEntryId,
          user_id: user.id,
        });
        if (error) throw error;
      }

      toast.success(`Salidas CPP registradas — Costo total: ${fmt(costoAcumulado)}`);
      onSave(costoAcumulado);
      setExitLines([{ productId: '', cantidad: '' }]);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar salidas');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar salida de inventario (CPP)</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Se detectó un asiento con costo de ventas. Registra las salidas de inventario correspondientes.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {exitLines.map((line, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Producto</Label>
                  <Select value={line.productId} onValueChange={v => updateLine(idx, 'productId', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min="0" value={line.cantidad} onChange={e => updateLine(idx, 'cantidad', e.target.value)} />
                </div>
                {exitLines.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>×</Button>
                )}
              </div>
              {linesPreviews[idx]?.cu > 0 && parseFloat(line.cantidad) > 0 && (
                <p className="text-xs text-muted-foreground pl-1">
                  C.U.: {fmt(linesPreviews[idx].cu)} → Costo: {fmt(linesPreviews[idx].ct)}
                </p>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLine}>+ Agregar línea</Button>
          {totalCosto > 0 && (
            <div className="text-sm font-medium text-right border-t pt-2">
              Costo total estimado: <span className="text-primary">{fmt(totalCosto)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Omitir</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar salidas'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
