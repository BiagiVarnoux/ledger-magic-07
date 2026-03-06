import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { fmt } from '@/accounting/utils';
import { calcularEstadoProducto, buildKardexRows, InventoryMovement } from './inventory-utils';
import { ManualMovementModal } from './ManualMovementModal';

interface Product {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string | null;
  unidad_medida: string;
}

interface ProductKardexModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  movements: InventoryMovement[];
  onMovementSaved: () => void;
  isReadOnly?: boolean;
}

export function ProductKardexModal({ isOpen, onClose, product, movements, onMovementSaved, isReadOnly }: ProductKardexModalProps) {
  const [showManual, setShowManual] = useState(false);
  const state = calcularEstadoProducto(movements);
  const rows = buildKardexRows(movements);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{product.nombre}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {product.codigo} {product.categoria && <Badge variant="outline" className="ml-2">{product.categoria}</Badge>}
                </p>
              </div>
              {!isReadOnly && (
                <Button size="sm" onClick={() => setShowManual(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nuevo Movimiento
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 my-4">
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-lg font-bold">{state.saldo} {product.unidad_medida}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">C.U. CPP</p>
              <p className="text-lg font-bold">Bs {fmt(state.costoUnitario)}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold">Bs {fmt(state.saldoValorado)}</p>
            </Card>
          </div>

          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sin movimientos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Salidas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">C.U. (Bs)</TableHead>
                  <TableHead className="text-right">Saldo Val. (Bs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className={
                      row.entrada > 0
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }
                  >
                    <TableCell>{row.fecha}</TableCell>
                    <TableCell>{row.concepto}</TableCell>
                    <TableCell className="text-right">{row.entrada > 0 ? row.entrada : ''}</TableCell>
                    <TableCell className="text-right">{row.salida > 0 ? row.salida : ''}</TableCell>
                    <TableCell className="text-right font-medium">{row.saldo}</TableCell>
                    <TableCell className="text-right">{fmt(row.costoUnitario)}</TableCell>
                    <TableCell className="text-right">{fmt(row.saldoValorado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <ManualMovementModal
        isOpen={showManual}
        onClose={() => setShowManual(false)}
        productId={product.id}
        productName={product.nombre}
        movements={movements}
        onSaved={() => { setShowManual(false); onMovementSaved(); }}
      />
    </>
  );
}
