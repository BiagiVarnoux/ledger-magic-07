import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fmt, todayISO } from '@/accounting/utils';
import {
  calculateTaxes,
  createSale,
  CANAL_LABELS,
  TIPO_PAGO_LABELS,
  type Canal,
  type TipoPago,
  type SaleItemInput,
  type MetodoValuacion,
} from '@/domain/sales';

interface ProductOption {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_inventario_id: string | null;
  metodo_valuacion: MetodoValuacion;
}

interface ItemRow extends SaleItemInput {
  _key: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const newRow = (): ItemRow => ({
  _key: Math.random().toString(36).slice(2),
  product_id: '',
  product_nombre: '',
  product_codigo: '',
  cuenta_inventario_id: null,
  metodo_valuacion: 'CPP',
  cantidad: 0,
  precio_unitario_neto: 0,
});

export function NuevaVentaModal({ isOpen, onClose, onSaved }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Header
  const [fecha, setFecha] = useState(todayISO());
  const [canal, setCanal] = useState<Canal>('electronica');
  const [conFactura, setConFactura] = useState(false);
  const [tipoPago, setTipoPago] = useState<TipoPago>('caja_mn');
  const [cliente, setCliente] = useState('');
  const [glosa, setGlosa] = useState('');

  // Items
  const [items, setItems] = useState<ItemRow[]>([newRow()]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setFecha(todayISO());
    setCanal('electronica');
    setConFactura(false);
    setTipoPago('caja_mn');
    setCliente('');
    setGlosa('');
    setItems([newRow()]);
    loadProducts();
  }, [isOpen]);

  async function loadProducts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('products')
      .select('id, codigo, nombre, cuenta_inventario_id, metodo_valuacion')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('nombre');
    setProducts((data ?? []) as ProductOption[]);
  }

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, ...patch } : it));
  }

  function handleProductChange(key: string, productId: string) {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    updateItem(key, {
      product_id: p.id,
      product_nombre: p.nombre,
      product_codigo: p.codigo,
      cuenta_inventario_id: p.cuenta_inventario_id,
      metodo_valuacion: p.metodo_valuacion,
    });
  }

  const totals = useMemo(() => calculateTaxes(items, conFactura), [items, conFactura]);

  function canAdvance(): boolean {
    return !!fecha && !!canal && !!tipoPago;
  }

  function canSubmit(): boolean {
    if (items.length === 0) return false;
    return items.every(it => it.product_id && it.cantidad > 0 && it.precio_unitario_neto > 0);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const cleanItems: SaleItemInput[] = items.map(({ _key, ...rest }) => rest);
      const result = await createSale(
        {
          fecha,
          canal,
          con_factura: conFactura,
          tipo_pago: tipoPago,
          cliente_nombre: cliente || null,
          glosa: glosa || null,
        },
        cleanItems,
      );
      toast.success(`Venta ${result.numero} registrada`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && !submitting && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Nueva Venta — Paso {step} de 2
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={canal} onValueChange={(v: Canal) => setCanal(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CANAL_LABELS) as Canal[]).map(c => (
                      <SelectItem key={c} value={c}>{CANAL_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Pago</Label>
                <Select value={tipoPago} onValueChange={(v: TipoPago) => setTipoPago(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_PAGO_LABELS) as TipoPago[]).map(t => (
                      <SelectItem key={t} value={t}>{TIPO_PAGO_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-2">
                <div>
                  <Label>Con Factura</Label>
                  <div className="text-xs text-muted-foreground">Aplica IVA 13% e IT 3%</div>
                </div>
                <Switch checked={conFactura} onCheckedChange={setConFactura} />
              </div>
              <div>
                <Label>Cliente (opcional)</Label>
                <Input value={cliente} onChange={e => setCliente(e.target.value)} />
              </div>
              <div>
                <Label>Glosa (opcional)</Label>
                <Input value={glosa} onChange={e => setGlosa(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!canAdvance()}>
                Siguiente <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Producto</TableHead>
                  <TableHead className="w-24 text-right">Cant.</TableHead>
                  <TableHead className="w-32 text-right">Precio Unit. Neto</TableHead>
                  <TableHead className="w-32 text-right">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => {
                  const subtotal = it.cantidad * it.precio_unitario_neto;
                  return (
                    <TableRow key={it._key}>
                      <TableCell>
                        <Select value={it.product_id} onValueChange={v => handleProductChange(it._key, v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar producto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.codigo} — {p.nombre} ({p.metodo_valuacion})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min="0" step="any"
                          className="h-9 text-right"
                          value={it.cantidad || ''}
                          onChange={e => updateItem(it._key, { cantidad: parseFloat(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min="0" step="any"
                          className="h-9 text-right"
                          value={it.precio_unitario_neto || ''}
                          onChange={e => updateItem(it._key, { precio_unitario_neto: parseFloat(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        Bs {fmt(subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setItems(prev => prev.filter(p => p._key !== it._key))}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Button variant="outline" size="sm" onClick={() => setItems(prev => [...prev, newRow()])}>
              <Plus className="w-4 h-4 mr-1.5" /> Agregar producto
            </Button>

            <div className="border rounded-lg p-4 bg-muted/30 space-y-1.5">
              {conFactura ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal neto</span>
                    <span className="font-mono">Bs {fmt(totals.precio_neto_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA (13%)</span>
                    <span className="font-mono">Bs {fmt(totals.total_iva)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IT (3%)</span>
                    <span className="font-mono">Bs {fmt(totals.total_it)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total cobrado</span>
                    <span className="font-mono">Bs {fmt(totals.total_cobrado)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-semibold">
                  <span>Total cobrado</span>
                  <span className="font-mono">Bs {fmt(totals.total_cobrado)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit() || submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {submitting ? 'Registrando...' : 'Registrar Venta'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
