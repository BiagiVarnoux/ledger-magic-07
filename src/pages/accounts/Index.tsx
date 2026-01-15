// src/pages/accounts/Index.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2, Save, Banknote, Calendar, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner';
import { Account, ACCOUNT_TYPES, SIDES, EXPENSE_CATEGORIES, ExpenseCategory } from '@/accounting/types';

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  COSTO_VENTAS: 'Costo de Ventas',
  GASTO_OPERATIVO: 'Gasto Operativo',
  OTRO_GASTO: 'Otro Gasto',
};

export default function AccountsPage() {
  const { accounts, entries, setAccounts, adapter } = useAccounting();
  const { isReadOnly } = useUserAccess();
  const [accDraft, setAccDraft] = useState<Partial<Account>>({ 
    type: "ACTIVO", 
    normal_side: "DEBE", 
    is_active: true,
    is_cash_equivalent: false,
    is_current: null,
    expense_category: null,
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
      setAccDraft({ 
        type: "ACTIVO", 
        normal_side: "DEBE", 
        is_active: true,
        is_cash_equivalent: false,
        is_current: null,
        expense_category: null,
      });
      setEditingAccId(null);
    } catch(e: any) { 
      toast.error(e.message || "Error guardando cuenta"); 
    }
  }

  function editAccount(a: Account) { 
    if (isReadOnly) return;
    setAccDraft({
      ...a,
      expense_category: a.expense_category ?? null,
      is_cash_equivalent: a.is_cash_equivalent ?? false,
      is_current: a.is_current ?? null,
    }); 
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
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-1">
                  <Label>Código</Label>
                  <Input 
                    value={accDraft.id || ""} 
                    onChange={e => setAccDraft(p => ({...p, id: e.target.value}))} 
                    placeholder="A.1" 
                  />
                </div>
                <div className="md:col-span-2">
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
                    onValueChange={(v) => setAccDraft(p => ({
                      ...p, 
                      type: v as any,
                      // Reset classification fields when type changes
                      expense_category: v === 'GASTO' ? p.expense_category : null,
                      is_cash_equivalent: v === 'ACTIVO' ? (p.is_cash_equivalent ?? false) : false,
                      is_current: (v === 'ACTIVO' || v === 'PASIVO') ? p.is_current : null,
                    }))}
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
                    <Checkbox
                      id="is_active"
                      checked={!!accDraft.is_active}
                      onCheckedChange={(checked) => setAccDraft(p => ({...p, is_active: !!checked}))}
                    />
                    <Label htmlFor="is_active">Activa</Label>
                  </div>
                </div>
              </div>

              {/* Conditional classification fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-muted">
                {/* Expense Category - Only for GASTO */}
                {accDraft.type === 'GASTO' && (
                  <div>
                    <Label className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Categoría de Gasto
                    </Label>
                    <Select 
                      value={accDraft.expense_category || "_none"}
                      onValueChange={(v) => setAccDraft(p => ({
                        ...p, 
                        expense_category: v === '_none' ? null : v as ExpenseCategory
                      }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Sin clasificar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin clasificar</SelectItem>
                        {EXPENSE_CATEGORIES.map(cat => 
                          <SelectItem key={cat} value={cat}>{EXPENSE_CATEGORY_LABELS[cat]}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Current/Non-Current - For ACTIVO and PASIVO */}
                {(accDraft.type === 'ACTIVO' || accDraft.type === 'PASIVO') && (
                  <div>
                    <Label className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Clasificación
                    </Label>
                    <Select 
                      value={accDraft.is_current === true ? 'current' : accDraft.is_current === false ? 'non_current' : '_auto'}
                      onValueChange={(v) => setAccDraft(p => ({
                        ...p, 
                        is_current: v === 'current' ? true : v === 'non_current' ? false : null
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_auto">Automático</SelectItem>
                        <SelectItem value="current">Corriente</SelectItem>
                        <SelectItem value="non_current">No Corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Cash Equivalent - Only for ACTIVO */}
                {accDraft.type === 'ACTIVO' && (
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                      <Checkbox
                        id="is_cash_equivalent"
                        checked={!!accDraft.is_cash_equivalent}
                        onCheckedChange={(checked) => setAccDraft(p => ({...p, is_cash_equivalent: !!checked}))}
                      />
                      <Label htmlFor="is_cash_equivalent" className="flex items-center gap-1 text-sm cursor-pointer">
                        <Banknote className="h-3 w-3" />
                        Es efectivo o equivalente
                      </Label>
                    </div>
                  </div>
                )}
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
                      setAccDraft({ 
                        type: "ACTIVO", 
                        normal_side: "DEBE", 
                        is_active: true,
                        is_cash_equivalent: false,
                        is_current: null,
                        expense_category: null,
                      }); 
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
                  <TableHead>Clasificación</TableHead>
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
                    <TableCell className="text-xs text-muted-foreground">
                      {a.type === 'GASTO' && a.expense_category && (
                        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded">
                          {EXPENSE_CATEGORY_LABELS[a.expense_category]}
                        </span>
                      )}
                      {(a.type === 'ACTIVO' || a.type === 'PASIVO') && a.is_current !== null && (
                        <span className={`px-2 py-0.5 rounded ${
                          a.is_current 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                        }`}>
                          {a.is_current ? 'Corriente' : 'No Corriente'}
                        </span>
                      )}
                      {a.type === 'ACTIVO' && a.is_cash_equivalent && (
                        <span className="ml-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                          Efectivo
                        </span>
                      )}
                    </TableCell>
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
