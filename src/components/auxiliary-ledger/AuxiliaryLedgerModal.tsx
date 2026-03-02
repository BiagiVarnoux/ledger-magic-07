import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { AuxiliaryLedgerEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';

interface AuxiliaryMovement {
  clientId: string;
  amount: number;
  client_name?: string;
}

interface LineToProcess {
  lineDraft: any;
  lineIndex: number;
  accountId: string;
  lineAmount: number;
  isIncrease: boolean;
}

interface AuxiliaryLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  linesToProcess: LineToProcess[];
  originalEntry: any;
  onSave: (entry: any) => void;
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
  const [showAllClients, setShowAllClients] = useState(false);

  const currentLine = linesToProcess[currentLineIndex];
  const currentMovements = lineMovements[currentLineIndex] || [];

  // Todos los clientes de esta cuenta
  const allClientsForAccount = auxiliaryEntries.filter(
    entry => entry.account_id === currentLine?.accountId
  );

  // Solo clientes con saldo distinto de cero
  const activeClientsForAccount = allClientsForAccount.filter(
    entry => Math.abs(entry.total_balance) >= 0.01
  );

  // Mostrar activos o todos según el toggle
  const clientsForAccount = showAllClients ? allClientsForAccount : activeClientsForAccount;

  // Cuántos están ocultos por saldo cero
  const hiddenZeroBalanceCount = allClientsForAccount.length - activeClientsForAccount.length;

  const totalAllocated = currentMovements.reduce((sum, mov) => sum + mov.amount, 0);
  const remaining = (currentLine?.lineAmount || 0) - totalAllocated;

  useEffect(() => {
    if (isOpen && linesToProcess.length > 0) {
      setCurrentLineIndex(0);
      setLineMovements({});
      setNewClientName('');
      setSelectedClientId('');
      setMovementAmount('');
      setShowAllClients(false);
    }
  }, [isOpen, linesToProcess]);

  useEffect(() => {
    setSelectedClientId('');
  }, [showAllClients, currentLineIndex]);

  const handleAddNewClient = () => {
    if (!newClientName.trim()) { toast.error('Ingresa el nombre del cliente'); return; }
    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (amount > remaining) { toast.error('El monto excede el saldo disponible'); return; }

    const newClientId = `new-${Date.now()}`;
    setLineMovements(prev => ({
      ...prev,
      [currentLineIndex]: [...(prev[currentLineIndex] || []), { clientId: newClientId, amount, client_name: newClientName }]
    }));
    setNewClientName('');
    setMovementAmount('');
  };

  const handleAddExistingClient = () => {
    if (!selectedClientId) { toast.error('Selecciona un cliente'); return; }
    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (amount > remaining) { toast.error('El monto excede el saldo disponible'); return; }
    if (currentMovements.find(mov => mov.clientId === selectedClientId)) {
      toast.error('Este cliente ya está en la lista'); return;
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

  const allLinesProcessed = linesToProcess.every((_, index) => {
    const movements = lineMovements[index] || [];
    const totalAllocated = movements.reduce((sum, mov) => sum + mov.amount, 0);
    return Math.abs(linesToProcess[index].lineAmount - totalAllocated) <= 0.01;
  });

  const handleSave = async () => {
    if (!allLinesProcessed) { toast.error('Debes completar la asignación de todas las líneas auxiliares'); return; }

    try {
      const movementDetails: any[] = [];
      
      for (let lineIndex = 0; lineIndex < linesToProcess.length; lineIndex++) {
        const line = linesToProcess[lineIndex];
        const movements = lineMovements[lineIndex] || [];
        
        for (const movement of movements) {
          let clientId = movement.clientId;
          
          if (movement.clientId.startsWith('new-')) {
            const newEntry: any = {
              id: crypto.randomUUID(),
              client_name: movement.client_name!,
              account_id: line.accountId,
              total_balance: 0
            };
            const savedEntry = await adapter.upsertAuxiliaryEntry(newEntry);
            clientId = savedEntry.id;
          }
          
          movementDetails.push({
            aux_entry_id: clientId,
            journal_entry_id: originalEntry.id,
            movement_date: originalEntry.date,
            amount: movement.amount,
            movement_type: line.isIncrease ? 'INCREASE' : 'DECREASE'
          });
        }
      }

      if (movementDetails.length > 0) {
        await adapter.upsertAuxiliaryMovementDetails(movementDetails);
      }

      const updatedEntries = await adapter.loadAuxiliaryEntries();
      setAuxiliaryEntries(updatedEntries);
      onSave(originalEntry);
      toast.success('Asiento y movimientos auxiliares guardados');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar movimientos');
    }
  };

  const getClientName = (clientId: string, movement?: AuxiliaryMovement) => {
    if (clientId.startsWith('new-') && movement?.client_name) return movement.client_name;
    return auxiliaryEntries.find(e => e.id === clientId)?.client_name || 'Cliente desconocido';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Gestión de Libros Auxiliares — Línea {currentLineIndex + 1} de {linesToProcess.length}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Cuenta: {currentLine?.accountId} — {currentLine?.isIncrease ? 'Registrar nueva deuda / cargo' : 'Registrar pago / cobro'}
          </div>
        </DialogHeader>

        <div className="space-y-4">

          {/* Totales */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Monto línea:</strong> {fmt(currentLine?.lineAmount || 0)}</div>
            <div><strong>Asignado:</strong> {fmt(totalAllocated)}</div>
            <div className={remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
              <strong>Restante:</strong> {fmt(remaining)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">

            {/* Nuevo Cliente */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Nuevo Cliente
                </h3>
                <div className="space-y-2">
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
                  <Button onClick={handleAddNewClient} className="w-full">
                    <Plus className="w-4 h-4 mr-1" />Agregar Nuevo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cliente Existente */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Minus className="w-4 h-4" />
                  Cliente Existente
                </h3>
                <div className="space-y-2">

                  {/* Toggle: solo activos vs todos */}
                  {hiddenZeroBalanceCount > 0 && (
                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <Eye className="w-3 h-3" />
                        {showAllClients
                          ? `Todos los clientes (${allClientsForAccount.length})`
                          : `${hiddenZeroBalanceCount} cliente${hiddenZeroBalanceCount > 1 ? 's' : ''} con saldo $0 oculto${hiddenZeroBalanceCount > 1 ? 's' : ''}`
                        }
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{showAllClients ? 'Todos' : 'Activos'}</span>
                        <Switch
                          checked={showAllClients}
                          onCheckedChange={setShowAllClients}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  )}

                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        clientsForAccount.length === 0
                          ? allClientsForAccount.length === 0 ? 'Sin clientes registrados' : 'Sin clientes con saldo activo'
                          : 'Seleccionar cliente'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForAccount.length === 0 ? (
                        <SelectItem value="_empty" disabled>
                          {allClientsForAccount.length === 0
                            ? 'No hay clientes registrados'
                            : 'Todos tienen saldo $0 — activa "Todos" para verlos'}
                        </SelectItem>
                      ) : (
                        clientsForAccount.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            <span className="flex items-center gap-2">
                              {client.client_name}
                              <span className={`text-xs font-mono ${
                                Math.abs(client.total_balance) < 0.01
                                  ? 'text-muted-foreground'
                                  : 'text-orange-600 font-semibold'
                              }`}>
                                ({fmt(client.total_balance)})
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Monto"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const c = clientsForAccount.find(c => c.id === selectedClientId);
                        if (c && c.total_balance > 0) {
                          setMovementAmount(Math.min(c.total_balance, remaining).toString());
                        } else if (c) {
                          toast.error('El cliente no tiene saldo pendiente');
                        } else {
                          toast.error('Selecciona un cliente primero');
                        }
                      }}
                      disabled={!selectedClientId}
                      title="Autocompletar con el saldo total del cliente"
                    >
                      Todo
                    </Button>
                  </div>

                  <Button
                    onClick={handleAddExistingClient}
                    className="w-full"
                    disabled={clientsForAccount.length === 0}
                  >
                    <Plus className="w-4 h-4 mr-1" />Agregar Existente
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Movimientos ya agregados en esta sesión */}
          {currentMovements.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Movimientos Registrados</h3>
                <div className="space-y-2">
                  {currentMovements.map((movement, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{getClientName(movement.clientId, movement)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{fmt(movement.amount)}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveMovement(index)}>
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navegación y acciones */}
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCurrentLineIndex(i => i - 1); setNewClientName(''); setSelectedClientId(''); setMovementAmount(''); }} disabled={currentLineIndex === 0}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => { setCurrentLineIndex(i => i + 1); setNewClientName(''); setSelectedClientId(''); setMovementAmount(''); }} disabled={currentLineIndex === linesToProcess.length - 1}>
                Siguiente
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="secondary" onClick={() => { onSave(originalEntry); onClose(); }}>
                Omitir y Guardar Asiento
              </Button>
              <Button onClick={handleSave} disabled={!allLinesProcessed}>
                Guardar Movimientos
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
