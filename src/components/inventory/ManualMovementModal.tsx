import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcularEstadoProducto, InventoryMovement } from './inventory-utils';
import { todayISO } from '@/accounting/utils';

interface ManualMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  movements: InventoryMovement[];
  onSaved: () => void;
}

export function ManualMovementModal({ isOpen, onClose, productId, productName, movements, onSaved }: ManualMovementModalProps) {
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [fecha, setFecha] = useState(todayISO());
  const [concepto, setConcepto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const qty = parseFloat(cantidad);
    if (!qty || qty <= 0) { toast.error('Cantidad inválida'); return; }

    let costoTotal = 0;
    let cu = 0;

    if (tipo === 'ENTRADA') {
      cu = parseFloat(costoUnitario);
      if (!cu || cu <= 0) { toast.error('Costo unitario requerido para entradas'); return; }
      costoTotal = qty * cu;
    } else {
      const state = calcularEstadoProducto(movements);
      cu = state.costoUnitario;
      costoTotal = qty * cu;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase.from('inventory_movements').insert({
        product_id: productId,
        fecha,
        tipo,
        cantidad: qty,
        costo_unitario: cu,
        costo_total: costoTotal,
        metodo_valuacion: 'CPP',
        referencia: referencia.trim() || concepto.trim() || null,
        user_id: user.id,
      });
      if (error) throw error;
      toast.success('Movimiento registrado');
      onSaved();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setTipo('ENTRADA'); setFecha(todayISO()); setConcepto(''); setCantidad(''); setCostoUnitario(''); setReferencia('');
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento Manual — {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as 'ENTRADA' | 'SALIDA')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SALIDA">Salida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ajuste inventario físico" />
          </div>
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input type="number" min="0" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>
          {tipo === 'ENTRADA' && (
            <div className="space-y-2">
              <Label>Costo unitario (Bs)</Label>
              <Input type="number" min="0" step="0.01" value={costoUnitario} onChange={e => setCostoUnitario(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
