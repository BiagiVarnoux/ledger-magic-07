import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingCart, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fmt, todayISO, round2 } from '@/accounting/utils';
import { useAccounting } from '@/accounting/AccountingProvider';
import { DEFAULT_COMPANY_ID } from '@/lib/constants';
import {
  calculateTaxes,
  createSale,
  CANAL_LABELS,
  TIPO_PAGO_LABELS,
  type Canal,
  type TipoPago,
  type SaleItemInput,
  type MetodoValuacion,
  type SaleItemEnriched,
} from '@/domain/sales';
import { fetchProductsStockBatch } from '@/domain/sales/stockService';
import { CustomerSearchCombobox } from '@/components/customers/CustomerSearchCombobox';

interface ProductOption {
  id: string;
  codigo: string;
  nombre: string;
  cuenta_inventario_id: string | null;
  metodo_valuacion: MetodoValuacion;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NuevaVentaModal({ isOpen, onClose, onSaved }: Props) {
  const { reloadEntries } = useAccounting();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { stock: number; cpp: number }>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmStockOpen, setConfirmStockOpen] = useState(false);

  // Header
  const [fecha, setFecha] = useState(todayISO());
  const [canal, setCanal] = useState<Canal>('electronica');
  const [conFactura, setConFactura] = useState(false);
  const [tipoPago, setTipoPago] = useState<TipoPago>('caja_mn');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [glosa, setGlosa] = useState('');

  // Items
  const [items, setItems] = useState<SaleItemEnriched[]>([]);

  // Buscador
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    loadProductsAndStock();
  }, [isOpen]);

  function resetForm() {
    setFecha(todayISO());
    setCanal('electronica');
    setConFactura(false);
    setTipoPago('caja_mn');
    setCustomerId(null);
    setCustomerName('');
    setGlosa('');
    setItems([]);
    setSearchQuery('');
    setSearchOpen(false);
  }

  async function loadProductsAndStock() {
    setLoadingProducts(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, codigo, nombre, cuenta_inventario_id, metodo_valuacion')
        .eq('company_id', DEFAULT_COMPANY_ID)
        .eq('status', 'activo')
        .order('nombre');
      const prods = (data ?? []) as ProductOption[];
      setProducts(prods);

      const ids = prods.map(p => p.id);
      const sm = await fetchProductsStockBatch(ids);
      setStockMap(sm);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error cargando productos');
    } finally {
      setLoadingProducts(false);
    }
  }

  // Cierra el dropdown de búsqueda al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, searchQuery]);

  function addProduct(product: ProductOption) {
    const existing = items.find(it => it.product_id === product.id);
    if (existing) {
      updateItem(existing._key, { cantidad: existing.cantidad + 1 });
    } else {
      const stockInfo = stockMap[product.id] ?? null;
      const newItem: SaleItemEnriched = {
        _key: Math.random().toString(36).slice(2),
        product_id: product.id,
        product_nombre: product.nombre,
        product_codigo: product.codigo,
        cuenta_inventario_id: product.cuenta_inventario_id,
        metodo_valuacion: product.metodo_valuacion,
        cantidad: 1,
        precio_unitario_neto: 0,
        stock_disponible: stockInfo?.stock ?? null,
        cpp_unitario: stockInfo?.cpp ?? null,
        margen_unitario: null,
        margen_porcentaje: null,
      };
      setItems(prev => [...prev, newItem]);
    }
    setSearchQuery('');
    setSearchOpen(false);
  }

  function updateItem(key: string, patch: Partial<SaleItemEnriched>) {
    setItems(prev => prev.map(it => {
      if (it._key !== key) return it;
      const updated = { ...it, ...patch };
      if (updated.cpp_unitario !== null && updated.precio_unitario_neto > 0) {
        updated.margen_unitario = round2(updated.precio_unitario_neto - updated.cpp_unitario);
        updated.margen_porcentaje = round2(
          (updated.margen_unitario / updated.precio_unitario_neto) * 100
        );
      } else {
        updated.margen_unitario = null;
        updated.margen_porcentaje = null;
      }
      return updated;
    }));
  }

  const extendedTotals = useMemo(() => {
    const taxes = calculateTaxes(items, conFactura);
    const costoTotal = items.reduce((sum, it) => {
      if (it.cpp_unitario === null) return sum;
      return sum + round2(it.cpp_unitario * it.cantidad);
    }, 0);
    const tieneEstimados = items.some(it => it.cpp_unitario === null && it.product_id);
    const margenBruto = round2(taxes.precio_neto_total - costoTotal);
    const margenPct = taxes.precio_neto_total > 0
      ? round2((margenBruto / taxes.precio_neto_total) * 100)
      : 0;
    return { ...taxes, costoTotal, margenBruto, margenPct, tieneEstimados };
  }, [items, conFactura]);

  function canSubmit() {
    if (items.length === 0) return false;
    return items.every(it => it.product_id && it.cantidad > 0 && it.precio_unitario_neto > 0);
  }

  const itemsWithInsufficientStock = useMemo(
    () => items.filter(it => it.stock_disponible !== null && it.cantidad > it.stock_disponible),
    [items]
  );

  function handleSubmitClick() {
    if (itemsWithInsufficientStock.length > 0) {
      setConfirmStockOpen(true);
    } else {
      doSubmit();
    }
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const cleanItems: SaleItemInput[] = items.map(({ _key, stock_disponible, cpp_unitario, margen_unitario, margen_porcentaje, ...rest }) => rest);
      const result = await createSale(
        {
          fecha,
          canal,
          con_factura: conFactura,
          tipo_pago: tipoPago,
          cliente_nombre: customerName || null,
          glosa: glosa || null,
        },
        cleanItems,
        DEFAULT_COMPANY_ID,
      );
      toast.success(`Venta ${result.numero} registrada`);
      await reloadEntries();
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  function stockColor(stock: number) {
    if (stock >= 5) return 'text-green-600';
    if (stock >= 1) return 'text-amber-600';
    return 'text-red-600';
  }

  function margenBadgeClass(pct: number) {
    if (pct < 5) return 'bg-red-100 text-red-700 border-red-300';
    if (pct < 20) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-green-100 text-green-700 border-green-300';
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={o => !o && !submitting && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Nueva Venta
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-6 items-start">
            {/* ── Columna izquierda: productos ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Buscador de productos */}
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  {loadingProducts ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  )}
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nombre o código..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    disabled={loadingProducts}
                  />
                </div>
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
                    {searchResults.map(p => {
                      const si = stockMap[p.id];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm border-b last:border-0"
                          onMouseDown={e => { e.preventDefault(); addProduct(p); }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs text-muted-foreground font-mono mr-1">{p.codigo}</span>
                              <span className="font-medium">{p.nombre}</span>
                            </div>
                            {si !== undefined ? (
                              <span className={`text-xs font-medium ${stockColor(si.stock)}`}>
                                Stock: {si.stock} u.
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin stock</span>
                            )}
                          </div>
                          {si && si.cpp > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              CPP: Bs {fmt(si.cpp)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tabla de ítems */}
              {items.length > 0 && (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Producto</TableHead>
                        <TableHead className="w-20 text-right">Cant.</TableHead>
                        <TableHead className="w-28 text-right">Precio Unit.</TableHead>
                        <TableHead className="w-24 text-right">CPP</TableHead>
                        <TableHead className="w-24 text-right">Margen Bs</TableHead>
                        <TableHead className="w-20 text-right">Margen %</TableHead>
                        <TableHead className="w-28 text-right">Subtotal</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(it => {
                        const subtotal = round2(it.cantidad * it.precio_unitario_neto);
                        const stockInsuf = it.stock_disponible !== null && it.cantidad > it.stock_disponible;
                        const belowCost = it.margen_porcentaje !== null && it.margen_porcentaje < 0;
                        return (
                          <React.Fragment key={it._key}>
                            <TableRow className={stockInsuf ? 'bg-amber-50/50' : ''}>
                              <TableCell>
                                <div className="font-medium text-sm leading-tight">{it.product_nombre}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {it.product_codigo && (
                                    <span className="text-xs text-muted-foreground font-mono">{it.product_codigo}</span>
                                  )}
                                  {it.stock_disponible !== null && (
                                    <Badge variant="outline" className={`text-xs px-1 py-0 ${stockColor(it.stock_disponible)} border-current`}>
                                      Stock: {it.stock_disponible}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  className="h-8 w-20 text-right"
                                  value={it.cantidad || ''}
                                  onChange={e => updateItem(it._key, { cantidad: parseFloat(e.target.value) || 0 })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="h-8 w-28 text-right"
                                  value={it.precio_unitario_neto || ''}
                                  onChange={e => updateItem(it._key, { precio_unitario_neto: parseFloat(e.target.value) || 0 })}
                                />
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {it.cpp_unitario !== null ? `Bs ${fmt(it.cpp_unitario)}` : '—'}
                              </TableCell>
                              <TableCell className={`text-right text-sm font-medium ${it.margen_unitario !== null ? (it.margen_unitario >= 0 ? 'text-green-700' : 'text-red-700') : 'text-muted-foreground'}`}>
                                {it.margen_unitario !== null ? `Bs ${fmt(it.margen_unitario)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                {it.margen_porcentaje !== null ? (
                                  <Badge variant="outline" className={`text-xs ${margenBadgeClass(it.margen_porcentaje)}`}>
                                    {it.margen_porcentaje.toFixed(1)}%
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm">
                                Bs {fmt(subtotal)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setItems(prev => prev.filter(p => p._key !== it._key))}
                                  disabled={items.length === 1}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {stockInsuf && (
                              <TableRow>
                                <TableCell colSpan={8} className="py-1 px-4">
                                  <p className="text-xs text-amber-700">
                                    ⚠ Stock insuficiente: disponible {it.stock_disponible} u.
                                  </p>
                                </TableCell>
                              </TableRow>
                            )}
                            {belowCost && (
                              <TableRow>
                                <TableCell colSpan={8} className="py-1 px-4">
                                  <p className="text-xs text-red-700">
                                    ✕ Precio por debajo del costo
                                  </p>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {items.length === 0 && !loadingProducts && (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm border rounded-md border-dashed">
                  Busca y agrega productos usando el buscador de arriba
                </div>
              )}
            </div>

            {/* ── Columna derecha: cabecera + totales ── */}
            <div className="w-80 shrink-0 space-y-4">
              <div className="space-y-3">
                <div>
                  <Label>Cliente</Label>
                  <CustomerSearchCombobox
                    value={customerId}
                    customerName={customerName}
                    onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
                    disabled={submitting}
                  />
                </div>

                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                  />
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

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Con Factura</Label>
                    <p className="text-xs text-muted-foreground">IVA 13% + IT 3%</p>
                  </div>
                  <Switch checked={conFactura} onCheckedChange={setConFactura} />
                </div>

                <div>
                  <Label>Glosa (opcional)</Label>
                  <Input
                    value={glosa}
                    onChange={e => setGlosa(e.target.value)}
                    placeholder="Descripción adicional..."
                  />
                </div>
              </div>

              {/* Cuadro de totales */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal neto</span>
                  <span className="font-mono">Bs {fmt(extendedTotals.precio_neto_total)}</span>
                </div>
                {conFactura && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA (13%)</span>
                      <span className="font-mono">Bs {fmt(extendedTotals.total_iva)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IT (3%)</span>
                      <span className="font-mono">Bs {fmt(extendedTotals.total_it)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total a cobrar</span>
                  <span className="font-mono">Bs {fmt(extendedTotals.total_cobrado)}</span>
                </div>

                {items.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Costo total{extendedTotals.tieneEstimados ? ' ~' : ''}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        Bs {fmt(extendedTotals.costoTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Margen bruto{extendedTotals.tieneEstimados ? ' ~' : ''}
                      </span>
                      <span className={`font-mono ${extendedTotals.margenBruto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Bs {fmt(extendedTotals.margenBruto)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Margen promedio</span>
                      <Badge variant="outline" className={margenBadgeClass(extendedTotals.margenPct)}>
                        {extendedTotals.margenPct.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmitClick}
                  disabled={!canSubmit() || submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {submitting ? 'Registrando...' : 'Registrar Venta'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de stock insuficiente */}
      <AlertDialog open={confirmStockOpen} onOpenChange={setConfirmStockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stock insuficiente</AlertDialogTitle>
            <AlertDialogDescription>
              {itemsWithInsufficientStock.length} producto(s) tienen stock insuficiente. El sistema rechazará la venta si no hay unidades disponibles. ¿Continuar de todas formas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmStockOpen(false); doSubmit(); }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
