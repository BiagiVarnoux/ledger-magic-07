import React, { useState, useEffect } from 'react';
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

export interface ProductData {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string | null;
  cuenta_inventario_id: string | null;
  descripcion: string | null;
  unidad_medida: string;
  is_active: boolean;
  user_id: string;
  metodo_valuacion: 'CPP' | 'FIFO';
}

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editProduct?: ProductData | null;
}

export function NewProductModal({ isOpen, onClose, onSaved, editProduct }: NewProductModalProps) {
  const { accounts } = useAccounting();
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [cuentaId, setCuentaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [metodoValuacion, setMetodoValuacion] = useState<'CPP' | 'FIFO'>('CPP');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editProduct;
  const activoAccounts = accounts.filter(a => a.type === 'ACTIVO' && a.is_active);

  useEffect(() => {
    if (editProduct) {
      setNombre(editProduct.nombre);
      setCodigo(editProduct.codigo);
      setCategoria(editProduct.categoria || 'otros');
      setCuentaId(editProduct.cuenta_inventario_id || '');
      setDescripcion(editProduct.descripcion || '');
      setUnidadMedida(editProduct.unidad_medida || 'unidad');
      setMetodoValuacion(editProduct.metodo_valuacion || 'CPP');
    } else {
      resetFields();
    }
  }, [editProduct, isOpen]);

  function resetFields() {
    setNombre(''); setCodigo(''); setCategoria('otros'); setCuentaId('');
    setDescripcion(''); setUnidadMedida('unidad'); setMetodoValuacion('CPP');
  }

  async function handleSave() {
    if (!nombre.trim() || !codigo.trim()) {
      toast.error('Nombre y código son requeridos');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const payload = {
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        categoria,
        cuenta_inventario_id: cuentaId || null,
        descripcion: descripcion.trim() || null,
        unidad_medida: unidadMedida.trim() || 'unidad',
        metodo_valuacion: metodoValuacion,
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct!.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Producto creado');
      }

      onSaved();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar producto');
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    resetFields();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
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
            <Label>Método de valuación de inventario</Label>
            <Select value={metodoValuacion} onValueChange={v => setMetodoValuacion(v as 'CPP' | 'FIFO')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CPP">CPP — Costo Promedio Ponderado</SelectItem>
                <SelectItem value="FIFO">FIFO — Primera entrada, primera salida</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {metodoValuacion === 'CPP'
                ? 'El costo de salida es el promedio de todos los lotes disponibles.'
                : 'El costo de salida usa primero el lote más antiguo (importación más vieja).'}
            </p>
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
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editProduct?: ProductData | null;
}

export function NewProductModal({ isOpen, onClose, onSaved, editProduct }: NewProductModalProps) {
  const { accounts } = useAccounting();
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [cuentaId, setCuentaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [saving, setSaving] = useState(false);

  const isEditing = !!editProduct;
  const activoAccounts = accounts.filter(a => a.type === 'ACTIVO' && a.is_active);

  useEffect(() => {
    if (editProduct) {
      setNombre(editProduct.nombre);
      setCodigo(editProduct.codigo);
      setCategoria(editProduct.categoria || 'otros');
      setCuentaId(editProduct.cuenta_inventario_id || '');
      setDescripcion(editProduct.descripcion || '');
      setUnidadMedida(editProduct.unidad_medida || 'unidad');
    } else {
      resetFields();
    }
  }, [editProduct, isOpen]);

  function resetFields() {
    setNombre(''); setCodigo(''); setCategoria('otros'); setCuentaId(''); setDescripcion(''); setUnidadMedida('unidad');
  }

  async function handleSave() {
    if (!nombre.trim() || !codigo.trim()) {
      toast.error('Nombre y código son requeridos');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const payload = {
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        categoria,
        cuenta_inventario_id: cuentaId || null,
        descripcion: descripcion.trim() || null,
        unidad_medida: unidadMedida.trim() || 'unidad',
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct!.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Producto creado');
      }

      onSaved();
      resetAndClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar producto');
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    resetFields();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
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
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
