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

interface LineToProcess {
  lineDraft: any; // LineDraft from journal page
  lineIndex: number;
  accountId: string;
  lineAmount: number;
  isIncrease: boolean;
}

interface AuxiliaryLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  linesToProcess: LineToProcess[];
  originalEntry: any; // JournalEntry from journal page
  onSave: (entry: any) => void; // Function to save the complete entry
}

export function AuxiliaryLedgerModal({ 
  isOpen, 
  onClose, 
  linesToProcess,
  originalEntry,
  onSave 
}: AuxiliaryLedgerModalProps) {
  const { auxiliaryEntries, setAuxiliaryEntries, adapter } = useAccounting();
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lineMovements, setLineMovements] = useState<{ [lineIndex: number]: AuxiliaryMovement[] }>({});
  const [newClientName, setNewClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [movementAmount, setMovementAmount] = useState('');

  const currentLine = linesToProcess[currentLineIndex];
  const currentMovements = lineMovements[currentLineIndex] || [];
  const clientsForAccount = auxiliaryEntries.filter(entry => entry.account_id === currentLine?.accountId);
  const totalAllocated = currentMovements.reduce((sum, mov) => sum + mov.amount, 0);
  const remaining = (currentLine?.lineAmount || 0) - totalAllocated;

  useEffect(() => {
    if (isOpen && linesToProcess.length > 0) {
      setCurrentLineIndex(0);
      setLineMovements({});
      setNewClientName('');
      setSelectedClientId('');
      setMovementAmount('');
    }
  }, [isOpen, linesToProcess]);

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
    setLineMovements(prev => ({
      ...prev,
      [currentLineIndex]: [...(prev[currentLineIndex] || []), { clientId: newClientId, amount }]
    }));
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

    const existingMovement = currentMovements.find(mov => mov.clientId === selectedClientId);
    if (existingMovement) {
      toast.error('Este cliente ya está en la lista');
      return;
    }

    setLineMovements(prev => ({
      ...prev,
      [currentLineIndex]: [...(prev[currentLineIndex] || []), { clientId: selectedClientId, amount }]
    }));
    setSelectedClientId('');
    setMovementAmount('');
  };

  const handleRemoveMovement = (index: number) => {
    setLineMovements(prev => ({
      ...prev,
      [currentLineIndex]: (prev[currentLineIndex] || []).filter((_, i) => i !== index)
    }));
  };

  // Verificar si todas las líneas están procesadas
  const allLinesProcessed = linesToProcess.every((_, index) => {
    const movements = lineMovements[index] || [];
    const totalAllocated = movements.reduce((sum, mov) => sum + mov.amount, 0);
    const remaining = linesToProcess[index].lineAmount - totalAllocated;
    return Math.abs(remaining) <= 0.01;
  });

  const handleSave = async () => {
    if (!allLinesProcessed) {
      toast.error('Debes completar la asignación de todas las líneas auxiliares');
      return;
    }

    try {
      // Process all auxiliary movements for all lines
      for (let lineIndex = 0; lineIndex < linesToProcess.length; lineIndex++) {
        const line = linesToProcess[lineIndex];
        const movements = lineMovements[lineIndex] || [];
        
        for (const movement of movements) {
          if (movement.clientId.startsWith('new-')) {
            // Create new client - we need to get the client name from the movement
            const newEntry: AuxiliaryLedgerEntry = {
              id: `${line.accountId}-${Date.now()}-${Math.random()}`,
              client_name: newClientName, // This needs to be stored per movement
              account_id: line.accountId,
              initial_amount: line.isIncrease ? movement.amount : 0,
              paid_amount: line.isIncrease ? 0 : movement.amount,
              total_balance: line.isIncrease ? movement.amount : -movement.amount // This will be removed in the adapter
            };
            await adapter.upsertAuxiliaryEntry(newEntry);
          } else {
            // Update existing client
            const existingEntry = auxiliaryEntries.find(e => e.id === movement.clientId);
            if (existingEntry) {
              const updatedEntry: AuxiliaryLedgerEntry = {
                ...existingEntry,
                paid_amount: line.isIncrease ? 
                  existingEntry.paid_amount : 
                  existingEntry.paid_amount + movement.amount,
                initial_amount: line.isIncrease ? 
                  existingEntry.initial_amount + movement.amount : 
                  existingEntry.initial_amount,
                total_balance: line.isIncrease ?
                  existingEntry.total_balance + movement.amount :
                  existingEntry.total_balance - movement.amount // This will be removed in the adapter
              };
              await adapter.upsertAuxiliaryEntry(updatedEntry);
            }
          }
        }
      }

      // Reload auxiliary entries
      const updatedEntries = await adapter.loadAuxiliaryEntries();
      setAuxiliaryEntries(updatedEntries);

      // Call parent save function with original entry
      onSave(originalEntry);
      toast.success('Asiento y movimientos auxiliares guardados');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar movimientos');
    }
  };

  const handlePrevious = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(currentLineIndex - 1);
      setNewClientName('');
      setSelectedClientId('');
      setMovementAmount('');
    }
  };

  const handleNext = () => {
    if (currentLineIndex < linesToProcess.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1);
      setNewClientName('');
      setSelectedClientId('');
      setMovementAmount('');
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
            Gestión de Libros Auxiliares - Línea {currentLineIndex + 1} de {linesToProcess.length}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Cuenta: {currentLine?.accountId} - {currentLine?.isIncrease ? 'Registrar Nueva Deuda' : 'Registrar Pago/Cobro'}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <strong>Monto línea:</strong> {fmt(currentLine?.lineAmount || 0)}
            </div>
            <div>
              <strong>Asignado:</strong> {fmt(totalAllocated)}
            </div>
            <div className={remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
              <strong>Restante:</strong> {fmt(remaining)}
            </div>
          </div>

          {currentLine?.isIncrease ? (
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

          {currentMovements.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Movimientos Registrados</h3>
                <div className="space-y-2">
                  {currentMovements.map((movement, index) => (
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

          {/* Navigation and Save buttons */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={currentLineIndex === 0}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                onClick={handleNext}
                disabled={currentLineIndex === linesToProcess.length - 1}
              >
                Siguiente
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!allLinesProcessed}
              >
                Guardar Asiento Completo
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}