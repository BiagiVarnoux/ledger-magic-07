import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Eye, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAccounting } from '@/accounting/AccountingProvider';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner';
import { fmt } from '@/accounting/utils';
import { calcularEstadoProducto, InventoryMovement } from '@/components/inventory/inventory-utils';
import { ProductKardexModal } from '@/components/inventory/ProductKardexModal';
import { NewProductModal } from '@/components/inventory/NewProductModal';

interface Product {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string | null;
  cuenta_inventario_id: string | null;
  descripcion: string | null;
  unidad_medida: string;
  is_active: boolean;
  user_id: string;
}

export default function InventoryPage() {
  const { accounts } = useAccounting();
  const { isReadOnly } = useUserAccess();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [kardexProduct, setKardexProduct] = useState<Product | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('No autenticado'); return; }

      const [prodsRes, movsRes] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('inventory_movements').select('*').eq('user_id', user.id),
      ]);

      setProducts((prodsRes.data || []) as Product[]);
      setMovements((movsRes.data || []) as InventoryMovement[]);
    } catch (e: any) {
      toast.error('Error cargando inventario');
    } finally {
      setLoading(false);
    }
  }

  // Group products by cuenta_inventario_id
  const accountGroups = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const p of products) {
      const key = p.cuenta_inventario_id || '__sin_cuenta__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [products]);

  // Compute total value per account group
  function getGroupValue(prods: Product[]): number {
    return prods.reduce((sum, p) => {
      const productMovs = movements.filter(m => m.product_id === p.id);
      const state = calcularEstadoProducto(productMovs);
      return sum + state.saldoValorado;
    }, 0);
  }

  const selectedProducts = selectedAccountId
    ? accountGroups[selectedAccountId] || []
    : [];

  function getProductState(productId: string) {
    const productMovs = movements.filter(m => m.product_id === productId);
    return calcularEstadoProducto(productMovs);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Cargando inventario...</p></div>;
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        {!isReadOnly && (
          <Button onClick={() => setShowNewProduct(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel: Account groups */}
        <div className="col-span-12 md:col-span-4 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Cuentas de Inventario</h3>
          {Object.keys(accountGroups).length === 0 && (
            <p className="text-sm text-muted-foreground">No hay productos registrados.</p>
          )}
          {Object.entries(accountGroups).map(([accountId, prods]) => {
            const account = accounts.find(a => a.id === accountId);
            const label = account ? `${account.id} — ${account.name}` : (accountId === '__sin_cuenta__' ? 'Sin cuenta asignada' : accountId);
            const totalValue = getGroupValue(prods);
            const isSelected = selectedAccountId === accountId;

            return (
              <Card
                key={accountId}
                className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? 'ring-2 ring-primary bg-accent/30' : ''}`}
                onClick={() => setSelectedAccountId(accountId)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{prods.length} producto(s)</p>
                  </div>
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold mt-2">Bs {fmt(totalValue)}</p>
              </Card>
            );
          })}
        </div>

        {/* Right panel: Products table */}
        <div className="col-span-12 md:col-span-8">
          {!selectedAccountId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="w-12 h-12 mb-4 opacity-40" />
              <p>Selecciona una cuenta de inventario para ver sus productos</p>
            </div>
          ) : selectedProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No hay productos en esta cuenta.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">C.U. CPP</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Último Mov.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedProducts.map(p => {
                  const s = getProductState(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell><Badge variant="outline">{p.codigo}</Badge></TableCell>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="text-right">{s.saldo} {p.unidad_medida}</TableCell>
                      <TableCell className="text-right">Bs {fmt(s.costoUnitario)}</TableCell>
                      <TableCell className="text-right font-medium">Bs {fmt(s.saldoValorado)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{s.ultimaFecha || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setKardexProduct(p)}>
                          <Eye className="w-4 h-4 mr-1" /> Kárdex
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modals */}
      {kardexProduct && (
        <ProductKardexModal
          isOpen={!!kardexProduct}
          onClose={() => setKardexProduct(null)}
          product={kardexProduct}
          movements={movements.filter(m => m.product_id === kardexProduct.id)}
          onMovementSaved={loadData}
          isReadOnly={isReadOnly}
        />
      )}

      <NewProductModal
        isOpen={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSaved={loadData}
      />
    </div>
  );
}
