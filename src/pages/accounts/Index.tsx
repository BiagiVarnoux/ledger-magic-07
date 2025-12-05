// src/pages/accounts/Index.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner';
import { Account, ACCOUNT_TYPES, SIDES } from '@/accounting/types';

export default function AccountsPage() {
  const { accounts, entries, setAccounts, adapter } = useAccounting();
  const { isReadOnly } = useUserAccess();
  const [accDraft, setAccDraft] = useState<Partial<Account>>({ 
    type: "ACTIVO", 
    normal_side: "DEBE", 
    is_active: true 
  });
  const [editingAccId, setEditingAccId] = useState<string | null>(null);

  async function upsertAccount() {
    if (isReadOnly) {
      toast.error("No tienes permisos para modificar cuentas");
      return;
    }
    const d = accDraft as Account;
    if (!d.id || !d.name || !d.type || !d.normal_side) { 
      toast.error("Completa código, nombre, tipo y lado"); 
      return; 
    }
    if (!ACCOUNT_TYPES.includes(d.type)) { 
      toast.error("Tipo inválido"); 
      return; 
    }
    if (!SIDES.includes(d.normal_side)) { 
      toast.error("Lado inválido"); 
      return; 
    }
    try {
      await adapter.upsertAccount(d);
      setAccounts(await adapter.loadAccounts());
      toast.success(editingAccId ? "Cuenta actualizada" : "Cuenta creada");
      setAccDraft({ type: "ACTIVO", normal_side: "DEBE", is_active: true });
      setEditingAccId(null);
    } catch(e: any) { 
      toast.error(e.message || "Error guardando cuenta"); 
    }
  }

  function editAccount(a: Account) { 
    if (isReadOnly) return;
    setAccDraft(a); 
    setEditingAccId(a.id); 
  }

  async function deleteAccount(id: string) { 
    if (isReadOnly) {
      toast.error("No tienes permisos para eliminar cuentas");
      return;
    }
    try { 
      await adapter.deleteAccount(id); 
      setAccounts(await adapter.loadAccounts()); 
      toast.success("Cuenta eliminada"); 
    } catch(e: any) { 
      toast.error(e.message || "No se pudo eliminar"); 
    } 
  }

  function canDeleteAccount(id: string) { 
    return !entries.some(e => e.lines.some(l => l.account_id === id)); 
  }

  async function toggleAccountStatus(account: Account) {
    if (isReadOnly) {
      toast.error("No tienes permisos para modificar cuentas");
      return;
    }
    const updated = { ...account, is_active: !account.is_active };
    try {
      await adapter.upsertAccount(updated);
      setAccounts(await adapter.loadAccounts());
      toast.success(`Cuenta ${updated.is_active ? 'activada' : 'desactivada'}`);
    } catch(e: any) {
      toast.error(e.message || "Error actualizando cuenta");
    }
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Plan de Cuentas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form - Only show for owners */}
          {!isReadOnly && (
            <>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-1">
                  <Label>Código</Label>
                  <Input 
                    value={accDraft.id || ""} 
                    onChange={e => setAccDraft(p => ({...p, id: e.target.value}))} 
                    placeholder="A.1" 
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nombre</Label>
                  <Input 
                    value={accDraft.name || ""} 
                    onChange={e => setAccDraft(p => ({...p, name: e.target.value}))} 
                    placeholder="Caja MN" 
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select 
                    value={accDraft.type as string} 
                    onValueChange={(v) => setAccDraft(p => ({...p, type: v as any}))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => 
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lado normal</Label>
                  <Select 
                    value={accDraft.normal_side as string} 
                    onValueChange={(v) => setAccDraft(p => ({...p, normal_side: v as any}))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIDES.map(s => 
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Label className="mr-2">Activa</Label>
                    <input 
                      type="checkbox" 
                      checked={!!accDraft.is_active} 
                      onChange={e => setAccDraft(p => ({...p, is_active: e.target.checked}))} 
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={upsertAccount}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingAccId ? "Guardar cambios" : "Agregar cuenta"}
                </Button>
                {editingAccId && (
                  <Button 
                    variant="outline" 
                    onClick={() => { 
                      setAccDraft({ type: "ACTIVO", normal_side: "DEBE", is_active: true }); 
                      setEditingAccId(null); 
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead>Estado</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.id}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{a.normal_side}</TableCell>
                    <TableCell>{a.is_active ? "Activa" : "Inactiva"}</TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => editAccount(a)} 
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => toggleAccountStatus(a)}
                        >
                          {a.is_active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteAccount(a.id)} 
                          disabled={!canDeleteAccount(a.id)} 
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
