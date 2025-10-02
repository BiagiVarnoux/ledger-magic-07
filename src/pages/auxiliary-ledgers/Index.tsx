import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { AuxiliaryLedgerEntry, AuxiliaryMovementDetail } from '@/accounting/types';
import { fmt, todayISO, toDecimal } from '@/accounting/utils';
import { AuxiliaryDefinitionsModal } from '@/components/auxiliary-ledger/AuxiliaryDefinitionsModal';

export default function AuxiliaryLedgersPage() {
  const { 
    accounts, 
    auxiliaryEntries, 
    auxiliaryDefinitions,
    setAuxiliaryEntries, 
    adapter, 
    entries: journalEntries 
  } = useAccounting();
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDefinitionsModalOpen, setIsDefinitionsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AuxiliaryLedgerEntry | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [clientMovements, setClientMovements] = useState<Record<string, AuxiliaryMovementDetail[]>>({});
  const [formData, setFormData] = useState({
    client_name: '',
    initial_amount: '0',
    movement_type: 'INCREASE' as 'INCREASE' | 'DECREASE'
  });

  const selectedDefinition = auxiliaryDefinitions.find(d => d.id === selectedDefinitionId);
  const selectedAccountId = selectedDefinition?.account_id || '';

  // Filter entries by selected definition
  const filteredEntries = useMemo(() => {
    if (!selectedDefinitionId || !selectedDefinition) return [];
    return auxiliaryEntries.filter(entry => 
      entry.definition_id === selectedDefinitionId || entry.account_id === selectedDefinition.account_id
    );
  }, [auxiliaryEntries, selectedDefinitionId, selectedDefinition]);

  // Load movement details when a client row is expanded
  useEffect(() => {
    const loadMovements = async () => {
      if (expandedClientId && !clientMovements[expandedClientId]) {
        try {
          const movements = await adapter.loadAuxiliaryDetails(expandedClientId);
          setClientMovements(prev => ({ ...prev, [expandedClientId]: movements }));
        } catch (error: any) {
          toast.error('Error al cargar movimientos del cliente');
        }
      }
    };
    loadMovements();
  }, [expandedClientId, adapter, clientMovements]);

  const handleOpenModal = (entry?: AuxiliaryLedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        client_name: entry.client_name,
        initial_amount: '0',
        movement_type: 'INCREASE'
      });
    } else {
      setEditingEntry(null);
      setFormData({
        client_name: '',
        initial_amount: '0',
        movement_type: 'INCREASE'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData({
      client_name: '',
      initial_amount: '0',
      movement_type: 'INCREASE'
    });
  };

  const handleSave = async () => {
    if (!selectedDefinitionId) {
      toast.error('Selecciona un libro auxiliar');
      return;
    }

    if (!formData.client_name.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }

    const entry: any = {
      id: editingEntry?.id || crypto.randomUUID(),
      client_name: formData.client_name.trim(),
      account_id: selectedAccountId,
      definition_id: selectedDefinitionId,
      total_balance: editingEntry?.total_balance || 0
    };

    try {
      // Save the auxiliary entry
      await adapter.upsertAuxiliaryEntry(entry);
      
      // Reload entries to get the correct ID from database
      let updatedEntries = await adapter.loadAuxiliaryEntries();
      const savedEntry = updatedEntries.find(e => 
        e.client_name === entry.client_name && 
        e.definition_id === entry.definition_id
      );
      
      // If adding a new client with initial balance, create initial movement
      if (!editingEntry && toDecimal(formData.initial_amount) > 0 && savedEntry) {
        const initialMovement: AuxiliaryMovementDetail = {
          id: crypto.randomUUID(),
          aux_entry_id: savedEntry.id,
          journal_entry_id: 'INITIAL_BALANCE',
          movement_date: todayISO(),
          amount: toDecimal(formData.initial_amount),
          movement_type: formData.movement_type
        };
        
        await adapter.upsertAuxiliaryMovementDetails([initialMovement]);
        // Reload again to get updated balances
        updatedEntries = await adapter.loadAuxiliaryEntries();
      }
      
      setAuxiliaryEntries(updatedEntries);
      toast.success(`Cliente ${editingEntry ? 'actualizado' : 'agregado'} exitosamente`);
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el cliente');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adapter.deleteAuxiliaryEntry(id);
      const updatedEntries = await adapter.loadAuxiliaryEntries();
      setAuxiliaryEntries(updatedEntries);
      toast.success('Cliente eliminado exitosamente');
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el cliente');
    }
  };

  const selectedAccountName = selectedDefinition ? 
    `${selectedDefinition.name} (${selectedDefinition.account_id})` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libros Auxiliares</h1>
        <Button variant="outline" onClick={() => setIsDefinitionsModalOpen(true)}>
          <Settings className="w-4 h-4 mr-2" />
          Gestionar Libros Auxiliares
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Seleccionar Libro Auxiliar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Libro Auxiliar</Label>
              <Select value={selectedDefinitionId} onValueChange={setSelectedDefinitionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un libro auxiliar" />
                </SelectTrigger>
                <SelectContent>
                  {auxiliaryDefinitions.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay libros auxiliares configurados
                    </SelectItem>
                  ) : (
                    auxiliaryDefinitions.map(def => {
                      const account = accounts.find(a => a.id === def.account_id);
                      return (
                        <SelectItem key={def.id} value={def.id}>
                          {def.name} — {def.account_id} ({account?.name || 'N/A'})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              {auxiliaryDefinitions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Primero debes crear libros auxiliares usando el botón "Gestionar Libros Auxiliares"
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => handleOpenModal()} 
                    disabled={!selectedDefinitionId}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingEntry ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nombre del Cliente/Proveedor</Label>
                      <Input
                        value={formData.client_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                        placeholder="Nombre completo"
                      />
                    </div>
                    
                    {!editingEntry && (
                      <>
                        <div>
                          <Label>Saldo Inicial</Label>
                          <Input
                            type="text"
                            value={formData.initial_amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, initial_amount: e.target.value }))}
                            placeholder="0,00"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Ingrese el saldo inicial de apertura (opcional)
                          </p>
                        </div>
                        
                        <div>
                          <Label>Tipo de Movimiento Inicial</Label>
                          <Select 
                            value={formData.movement_type} 
                            onValueChange={(value: 'INCREASE' | 'DECREASE') => 
                              setFormData(prev => ({ ...prev, movement_type: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INCREASE">
                                DEBE (Aumento de Activo, Disminución de Pasivo)
                              </SelectItem>
                              <SelectItem value="DECREASE">
                                HABER (Disminución de Activo, Aumento de Pasivo)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    
                    {editingEntry && (
                      <p className="text-sm text-muted-foreground">
                        Los saldos se calculan automáticamente desde los asientos del Libro Diario.
                      </p>
                    )}
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={handleCloseModal}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave}>
                        {editingEntry ? 'Actualizar' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedDefinitionId && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              {selectedAccountName} — Detalle por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Cliente/Proveedor</TableHead>
                    <TableHead className="text-right">Saldo Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No hay registros para esta cuenta
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map(entry => (
                      <Collapsible
                        key={entry.id}
                        open={expandedClientId === entry.id}
                        onOpenChange={(open) => setExpandedClientId(open ? entry.id : null)}
                        asChild
                      >
                        <>
                          <TableRow>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  {expandedClientId === entry.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.client_name}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${
                              entry.total_balance > 0 ? 'text-orange-600' : 
                              entry.total_balance < 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {fmt(entry.total_balance)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenModal(entry)}
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(entry.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/30 p-4">
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Historial de Movimientos</h4>
                                  {!clientMovements[entry.id] ? (
                                    <div className="text-sm text-muted-foreground">Cargando...</div>
                                  ) : clientMovements[entry.id].length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No hay movimientos registrados</div>
                                  ) : (
                                    <div className="border rounded-lg overflow-hidden bg-background">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Asiento</TableHead>
                                            <TableHead>Glosa</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {clientMovements[entry.id].map((movement) => {
                                            const isInitialBalance = movement.journal_entry_id === 'INITIAL_BALANCE';
                                            const journalEntry = isInitialBalance 
                                              ? null 
                                              : journalEntries.find(je => je.id === movement.journal_entry_id);
                                            const memo = isInitialBalance 
                                              ? 'Saldo inicial de apertura' 
                                              : (journalEntry?.memo || '-');
                                            
                                            return (
                                              <TableRow key={movement.id}>
                                                <TableCell>{movement.movement_date}</TableCell>
                                                <TableCell className="font-mono text-sm">{movement.journal_entry_id}</TableCell>
                                                <TableCell className="text-sm">{memo}</TableCell>
                                                <TableCell>
                                                  <div className="flex items-center gap-1">
                                                    {movement.movement_type === 'INCREASE' ? (
                                                      <>
                                                        <TrendingUp className="w-4 h-4 text-orange-600" />
                                                        <span className="text-sm text-orange-600">Aumento</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <TrendingDown className="w-4 h-4 text-green-600" />
                                                        <span className="text-sm text-green-600">Disminución</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                  {fmt(movement.amount)}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AuxiliaryDefinitionsModal
        isOpen={isDefinitionsModalOpen}
        onClose={() => setIsDefinitionsModalOpen(false)}
      />
    </div>
  );
}