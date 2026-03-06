import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcularEstadoProducto, InventoryMovement } from './inventory-utils';

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
  onSave: () => void;
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

  async function handleSave() {
    const validLines = exitLines.filter(l => l.productId && parseFloat(l.cantidad) > 0);
    if (validLines.length === 0) { toast.error('Agrega al menos una línea'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      for (const line of validLines) {
        const qty = parseFloat(line.cantidad);
        const productMovements = allMovements.filter(m => m.product_id === line.productId);
        const state = calcularEstadoProducto(productMovements);
        const cu = state.costoUnitario;

        const { error } = await supabase.from('inventory_movements').insert({
          product_id: line.productId,
          fecha: journalDate,
          tipo: 'SALIDA',
          cantidad: qty,
          costo_unitario: cu,
          costo_total: qty * cu,
          metodo_valuacion: 'CPP',
          referencia: journalEntryId,
          journal_entry_id: journalEntryId,
          user_id: user.id,
        });
        if (error) throw error;
      }

      toast.success('Salidas de inventario registradas');
      onSave();
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
            Se detectó un asiento con costo de ventas. ¿Deseas registrar las salidas de inventario?
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {exitLines.map((line, idx) => (
            <div key={idx} className="flex items-end gap-2">
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
          ))}
          <Button variant="outline" size="sm" onClick={addLine}>+ Agregar línea</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Omitir</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar salidas'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
