import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAccounting } from '@/accounting/AccountingProvider';
import { toast } from 'sonner';

const CATEGORIAS = [
  { value: 'electronica', label: 'Electrónica/Tecnología' },
  { value: 'juguetes', label: 'Juguetes' },
  { value: 'repuestos', label: 'Repuestos' },
  { value: 'otros', label: 'Otros' },
];

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NewProductModal({ isOpen, onClose, onSaved }: NewProductModalProps) {
  const { accounts } = useAccounting();
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [cuentaId, setCuentaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [saving, setSaving] = useState(false);

  const activoAccounts = accounts.filter(a => a.type === 'ACTIVO' && a.is_active);

  async function handleSave() {
    if (!nombre.trim() || !codigo.trim()) {
      toast.error('Nombre y código son requeridos');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { error } = await supabase.from('products').insert({
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        categoria,
        cuenta_inventario_id: cuentaId || null,
        descripcion: descripcion.trim() || null,
        unidad_medida: unidadMedida.trim() || 'unidad',
        user_id: user.id,
      });
      if (error) throw error;
      toast.success('Producto creado');
      onSaved();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al crear producto');
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setNombre(''); setCodigo(''); setCategoria('otros'); setCuentaId(''); setDescripcion(''); setUnidadMedida('unidad');
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Producto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div className="space-y-2">
            <Label>Código/SKU *</Label>
            <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="SKU-001" />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cuenta Contable (Activo)</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
              <SelectContent>
                {activoAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} — {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div className="space-y-2">
            <Label>Unidad de medida</Label>
            <Input value={unidadMedida} onChange={e => setUnidadMedida(e.target.value)} />
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
