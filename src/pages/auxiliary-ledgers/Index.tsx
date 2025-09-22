import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { AuxiliaryLedgerEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';

export default function AuxiliaryLedgersPage() {
  const { accounts, auxiliaryEntries, setAuxiliaryEntries, adapter } = useAccounting();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AuxiliaryLedgerEntry | null>(null);
  const [formData, setFormData] = useState({
    client_name: '',
    initial_amount: '',
    paid_amount: ''
  });

  // Filter auxiliary accounts (Cuentas por Cobrar and Cuentas por Pagar)
  const auxiliaryAccounts = accounts.filter(acc => 
    acc.id === 'A.5' || acc.id === 'P.1'
  );

  // Filter entries by selected account
  const filteredEntries = useMemo(() => {
    if (!selectedAccount) return [];
    return auxiliaryEntries
      .filter(entry => entry.account_id === selectedAccount)
      .map(entry => ({
        ...entry,
        total_balance: entry.initial_amount - entry.paid_amount
      }));
  }, [auxiliaryEntries, selectedAccount]);

  const handleOpenModal = (entry?: AuxiliaryLedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        client_name: entry.client_name,
        initial_amount: entry.initial_amount.toString(),
        paid_amount: entry.paid_amount.toString()
      });
    } else {
      setEditingEntry(null);
      setFormData({
        client_name: '',
        initial_amount: '',
        paid_amount: '0'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData({
      client_name: '',
      initial_amount: '',
      paid_amount: '0'
    });
  };

  const handleSave = async () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta auxiliar');
      return;
    }

    if (!formData.client_name.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }

    const initialAmount = parseFloat(formData.initial_amount) || 0;
    const paidAmount = parseFloat(formData.paid_amount) || 0;

    if (initialAmount <= 0) {
      toast.error('El monto inicial debe ser mayor a 0');
      return;
    }

    if (paidAmount < 0) {
      toast.error('El monto pagado no puede ser negativo');
      return;
    }

    const entry: AuxiliaryLedgerEntry = {
      id: editingEntry?.id || `${selectedAccount}-${Date.now()}`,
      client_name: formData.client_name.trim(),
      account_id: selectedAccount,
      initial_amount: initialAmount,
      paid_amount: paidAmount,
      total_balance: initialAmount - paidAmount
    };

    try {
      await adapter.upsertAuxiliaryEntry(entry);
      const updatedEntries = await adapter.loadAuxiliaryEntries();
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

  const selectedAccountName = auxiliaryAccounts.find(acc => acc.id === selectedAccount)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libros Auxiliares</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Seleccionar Cuenta Auxiliar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cuenta</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta auxiliar" />
                </SelectTrigger>
                <SelectContent>
                  {auxiliaryAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.id} — {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => handleOpenModal()} 
                    disabled={!selectedAccount}
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
                    <div>
                      <Label>Monto Inicial</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.initial_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, initial_amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Monto Pagado</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.paid_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
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

      {selectedAccount && (
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
                    <TableHead>Cliente/Proveedor</TableHead>
                    <TableHead className="text-right">Monto Inicial</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Saldo Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay registros para esta cuenta
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.client_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(entry.initial_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(entry.paid_amount)}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}