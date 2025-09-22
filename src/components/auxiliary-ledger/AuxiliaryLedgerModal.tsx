import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { AuxiliaryLedgerEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';

interface AuxiliaryMovement {
  clientId: string;
  amount: number;
}

interface AuxiliaryLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  lineAmount: number;
  isIncrease: boolean; // true para aumentos (nuevas deudas), false para disminuciones (pagos)
  onSave: (movements: AuxiliaryMovement[]) => void;
}

export function AuxiliaryLedgerModal({ 
  isOpen, 
  onClose, 
  accountId, 
  lineAmount, 
  isIncrease,
  onSave 
}: AuxiliaryLedgerModalProps) {
  const { auxiliaryEntries, setAuxiliaryEntries, adapter } = useAccounting();
  const [movements, setMovements] = useState<AuxiliaryMovement[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [movementAmount, setMovementAmount] = useState('');

  const clientsForAccount = auxiliaryEntries.filter(entry => entry.account_id === accountId);
  const totalAllocated = movements.reduce((sum, mov) => sum + mov.amount, 0);
  const remaining = lineAmount - totalAllocated;

  useEffect(() => {
    if (isOpen) {
      setMovements([]);
      setNewClientName('');
      setSelectedClientId('');
      setMovementAmount('');
    }
  }, [isOpen]);

  const handleAddNewClient = () => {
    if (!newClientName.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }

    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    if (amount > remaining) {
      toast.error('El monto excede el saldo disponible');
      return;
    }

    const newClientId = `new-${Date.now()}`;
    setMovements(prev => [...prev, { clientId: newClientId, amount }]);
    setNewClientName('');
    setMovementAmount('');
  };

  const handleAddExistingClient = () => {
    if (!selectedClientId) {
      toast.error('Selecciona un cliente');
      return;
    }

    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    if (amount > remaining) {
      toast.error('El monto excede el saldo disponible');
      return;
    }

    const existingMovement = movements.find(mov => mov.clientId === selectedClientId);
    if (existingMovement) {
      toast.error('Este cliente ya está en la lista');
      return;
    }

    setMovements(prev => [...prev, { clientId: selectedClientId, amount }]);
    setSelectedClientId('');
    setMovementAmount('');
  };

  const handleRemoveMovement = (index: number) => {
    setMovements(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (Math.abs(remaining) > 0.01) {
      toast.error(`Falta asignar ${fmt(remaining)}`);
      return;
    }

    try {
      // Update or create auxiliary entries
      for (const movement of movements) {
        if (movement.clientId.startsWith('new-')) {
          // Create new client
          const newEntry: AuxiliaryLedgerEntry = {
            id: `${accountId}-${Date.now()}-${Math.random()}`,
            client_name: newClientName,
            account_id: accountId,
            initial_amount: isIncrease ? movement.amount : 0,
            paid_amount: isIncrease ? 0 : movement.amount,
            total_balance: isIncrease ? movement.amount : -movement.amount
          };
          await adapter.upsertAuxiliaryEntry(newEntry);
        } else {
          // Update existing client
          const existingEntry = auxiliaryEntries.find(e => e.id === movement.clientId);
          if (existingEntry) {
            const updatedEntry: AuxiliaryLedgerEntry = {
              ...existingEntry,
              paid_amount: isIncrease ? 
                existingEntry.paid_amount : 
                existingEntry.paid_amount + movement.amount,
              initial_amount: isIncrease ? 
                existingEntry.initial_amount + movement.amount : 
                existingEntry.initial_amount,
              total_balance: isIncrease ?
                existingEntry.total_balance + movement.amount :
                existingEntry.total_balance - movement.amount
            };
            await adapter.upsertAuxiliaryEntry(updatedEntry);
          }
        }
      }

      // Reload auxiliary entries
      const updatedEntries = await adapter.loadAuxiliaryEntries();
      setAuxiliaryEntries(updatedEntries);

      onSave(movements);
      toast.success('Movimientos auxiliares guardados');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar movimientos');
    }
  };

  const getClientName = (clientId: string) => {
    if (clientId.startsWith('new-')) return newClientName;
    return auxiliaryEntries.find(e => e.id === clientId)?.client_name || 'Cliente desconocido';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isIncrease ? 'Registrar Nueva Deuda' : 'Registrar Pago/Cobro'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <strong>Monto línea:</strong> {fmt(lineAmount)}
            </div>
            <div>
              <strong>Asignado:</strong> {fmt(totalAllocated)}
            </div>
            <div className={remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
              <strong>Restante:</strong> {fmt(remaining)}
            </div>
          </div>

          {isIncrease ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Nuevo Cliente/Deuda</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Nombre del cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                  />
                  <Button onClick={handleAddNewClient}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Pago de Cliente Existente</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForAccount.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name} (Saldo: {fmt(client.total_balance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                  />
                  <Button onClick={handleAddExistingClient}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {movements.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Movimientos Registrados</h3>
                <div className="space-y-2">
                  {movements.map((movement, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>{getClientName(movement.clientId)}</span>
                      <div className="flex items-center gap-2">
                        <span>{fmt(movement.amount)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMovement(index)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={Math.abs(remaining) > 0.01}
            >
              Guardar Movimientos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}