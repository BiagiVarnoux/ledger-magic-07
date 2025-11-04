import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';

export interface KardexData {
  concepto: string;
  entrada: number;
  salidas: number;
  costo_total: number;
}

interface InlineKardexPopupProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  lineAmount?: number;
  isIncrease: boolean;
  onSave: (data: KardexData) => void;
  initialData?: KardexData;
}

export function InlineKardexPopup({
  isOpen,
  onClose,
  accountId,
  lineAmount,
  isIncrease,
  onSave,
  initialData
}: InlineKardexPopupProps) {
  const { accounts } = useAccounting();
  const [concepto, setConcepto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoTotal, setCostoTotal] = useState('');

  const account = accounts.find(a => a.id === accountId);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setConcepto(initialData.concepto);
        setCantidad(String(initialData.entrada || initialData.salidas));
        setCostoTotal(String(initialData.costo_total));
      } else {
        setConcepto('');
        setCantidad('');
        setCostoTotal(isIncrease && lineAmount ? String(lineAmount) : '');
      }
    }
  }, [isOpen, initialData, isIncrease, lineAmount]);

  const handleSave = () => {
    if (!concepto.trim()) {
      toast.error('Ingresa el concepto');
      return;
    }

    const cantidadNum = parseFloat(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    const costoTotalNum = parseFloat(costoTotal);
    
    // Para entradas, el costo total es requerido
    if (isIncrease && (!costoTotalNum || costoTotalNum <= 0)) {
      toast.error('Para entradas, el costo total es requerido');
      return;
    }

    const kardexData: KardexData = {
      concepto: concepto.trim(),
      entrada: isIncrease ? cantidadNum : 0,
      salidas: isIncrease ? 0 : cantidadNum,
      costo_total: isIncrease ? costoTotalNum : 0
    };

    onSave(kardexData);
    toast.success('Movimiento de Kárdex registrado');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento de Kárdex</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Cuenta: {accountId} - {account?.name}
          </div>
          <div className="text-sm font-medium">
            {isIncrease ? '📈 Entrada (Compra)' : '📉 Salida (Venta/Uso)'}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Concepto</Label>
            <Input
              placeholder="Ej. Compra Lote 1, Venta Cliente X"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-sm font-medium">
              {isIncrease ? 'Cantidad de Entrada' : 'Cantidad de Salida'}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          {isIncrease && (
            <div>
              <Label className="text-sm font-medium">Costo Total (Bs.)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costoTotal}
                onChange={(e) => setCostoTotal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {lineAmount 
                  ? `Monto total de la compra según el asiento: ${lineAmount.toFixed(2)}`
                  : 'Ingresa el monto total de la compra'}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
