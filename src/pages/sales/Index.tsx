import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ShoppingCart, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner';
import { fmt } from '@/accounting/utils';
import { listSales, voidSale, CANAL_LABELS, type SaleRow } from '@/domain/sales';
import { NuevaVentaModal } from '@/components/sales/NuevaVentaModal';

export default function SalesPage() {
  const { isReadOnly } = useUserAccess();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // void flow
  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null);
  const [voidStep, setVoidStep] = useState<1 | 2>(1);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setSales(await listSales());
    } catch (e: any) {
      toast.error(e.message || 'Error cargando ventas');
    } finally {
      setLoading(false);
    }
  }

  function startVoid(sale: SaleRow) {
    setVoidTarget(sale);
    setVoidStep(1);
    setVoidReason('');
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await voidSale(voidTarget.id, voidReason);
      toast.success(`Venta ${voidTarget.numero} anulada`);
      setVoidTarget(null);
      setVoidStep(1);
      setVoidReason('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al anular');
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" /> Ventas
        </h1>
        {!isReadOnly && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Venta
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Cargando ventas...</p>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShoppingCart className="w-12 h-12 mb-4 opacity-40" />
          <p>Aún no hay ventas registradas.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-center">Factura</TableHead>
              <TableHead className="text-right">Total Cobrado</TableHead>
              <TableHead className="text-right">Costo Total</TableHead>
              <TableHead className="text-right">Margen Bruto</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map(s => {
              const margen = (s.precio_neto_total ?? 0) - (s.total_costo ?? 0);
              return (
                <TableRow key={s.id} className={s.estado === 'voided' ? 'opacity-60' : ''}>
                  <TableCell className="font-mono text-xs">{s.numero}</TableCell>
                  <TableCell>{s.fecha}</TableCell>
                  <TableCell>{s.cliente_nombre || '—'}</TableCell>
                  <TableCell>{CANAL_LABELS[s.canal] ?? s.canal}</TableCell>
                  <TableCell className="text-center">
                    {s.con_factura ? <Badge variant="outline">Sí</Badge> : <span className="text-muted-foreground text-xs">No</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">Bs {fmt(s.total_cobrado)}</TableCell>
                  <TableCell className="text-right">Bs {fmt(s.total_costo ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">Bs {fmt(margen)}</TableCell>
                  <TableCell className="text-center">
                    {s.estado === 'confirmed' ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Activa</Badge>
                    ) : (
                      <Badge variant="destructive">Anulada</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!isReadOnly && s.estado === 'confirmed' && (
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive"
                        onClick={() => startVoid(s)}
                      >
                        <Ban className="w-4 h-4 mr-1" /> Anular
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <NuevaVentaModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSaved={load}
      />

      {/* Void confirmation step 1: ask for reason */}
      <AlertDialog
        open={!!voidTarget && voidStep === 1}
        onOpenChange={o => { if (!o) { setVoidTarget(null); setVoidStep(1); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta {voidTarget?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará un asiento de reversión y el stock será restaurado. Indica el motivo de la anulación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo de la anulación..."
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (voidReason.trim()) setVoidStep(2); }}
              disabled={!voidReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void confirmation step 2 */}
      <AlertDialog
        open={!!voidTarget && voidStep === 2}
        onOpenChange={o => { if (!o) { setVoidTarget(null); setVoidStep(1); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción generará un asiento de reversión irrevocable para la venta {voidTarget?.numero}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setVoidTarget(null); setVoidStep(1); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmVoid}
              disabled={voiding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voiding ? 'Anulando...' : 'Confirmar anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
