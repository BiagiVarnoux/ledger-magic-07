// src/components/auxiliary-ledger/AuxiliaryDefinitionsModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { AuxiliaryLedgerDefinition } from '@/accounting/types';

interface AuxiliaryDefinitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuxiliaryDefinitionsModal({ isOpen, onClose }: AuxiliaryDefinitionsModalProps) {
  const { accounts, adapter, auxiliaryDefinitions, setAuxiliaryDefinitions } = useAccounting();
  const [editingDefinition, setEditingDefinition] = useState<AuxiliaryLedgerDefinition | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    account_id: ''
  });

  const balanceAccounts = accounts.filter(a => 
    a.is_active && ['ACTIVO', 'PASIVO', 'PATRIMONIO'].includes(a.type)
  );

  const handleOpenForm = (def?: AuxiliaryLedgerDefinition) => {
    if (def) {
      setEditingDefinition(def);
      setFormData({ name: def.name, account_id: def.account_id });
    } else {
      setEditingDefinition(null);
      setFormData({ name: '', account_id: '' });
    }
  };

  const handleCloseForm = () => {
    setEditingDefinition(null);
    setFormData({ name: '', account_id: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre del libro auxiliar es requerido");
      return;
    }
    if (!formData.account_id) {
      toast.error("Debe seleccionar una cuenta");
      return;
    }

    // Check if account is already used by another definition
    const existingDef = auxiliaryDefinitions.find(
      d => d.account_id === formData.account_id && d.id !== editingDefinition?.id
    );
    if (existingDef) {
      toast.error(`La cuenta ${formData.account_id} ya tiene un libro auxiliar: ${existingDef.name}`);
      return;
    }

    const definition: AuxiliaryLedgerDefinition = {
      id: editingDefinition?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      account_id: formData.account_id
    };

    try {
      await adapter.upsertAuxiliaryDefinition(definition);
      const updated = await adapter.loadAuxiliaryDefinitions();
      setAuxiliaryDefinitions(updated);
      toast.success(`Libro auxiliar ${editingDefinition ? 'actualizado' : 'creado'}`);
      handleCloseForm();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta definición de libro auxiliar? Los datos de clientes asociados no se eliminarán.")) return;
    
    try {
      await adapter.deleteAuxiliaryDefinition(id);
      const updated = await adapter.loadAuxiliaryDefinitions();
      setAuxiliaryDefinitions(updated);
      toast.success("Definición eliminada");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Libros Auxiliares</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">{editingDefinition ? 'Editar' : 'Nuevo'} Libro Auxiliar</h3>
            
            <div>
              <Label>Nombre del Libro Auxiliar</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Inventario Detallado, Clientes VIP, etc."
              />
            </div>

            <div>
              <Label>Cuenta Contable</Label>
              <Select 
                value={formData.account_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta de Balance" />
                </SelectTrigger>
                <SelectContent>
                  {balanceAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.id} — {a.name} ({a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Solo cuentas de ACTIVO, PASIVO o PATRIMONIO
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>
                {editingDefinition ? 'Actualizar' : 'Crear'} Libro Auxiliar
              </Button>
              {editingDefinition && (
                <Button variant="outline" onClick={handleCloseForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* List Section */}
          <div>
            <h3 className="font-medium mb-2">Libros Auxiliares Configurados</h3>
            {auxiliaryDefinitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay libros auxiliares configurados</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auxiliaryDefinitions.map(def => {
                      const account = accounts.find(a => a.id === def.account_id);
                      return (
                        <TableRow key={def.id}>
                          <TableCell className="font-medium">{def.name}</TableCell>
                          <TableCell>{def.account_id} — {account?.name || 'N/A'}</TableCell>
                          <TableCell>{account?.type || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => handleOpenForm(def)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(def.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
