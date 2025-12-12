// src/components/journal/JournalEntriesTable.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Undo2, Trash2, Pencil, ArrowUpDown } from 'lucide-react';
import { AccountLabel } from './AccountLabel';
import { JournalEntry, Account } from '@/accounting/types';
import { fmt } from '@/accounting/utils';

interface JournalEntriesTableProps {
  entries: JournalEntry[];
  accounts: Account[];
  isReadOnly: boolean;
  sortOrder: 'asc' | 'desc';
  selectedQuarter: string;
  onSortOrderChange: () => void;
  onEdit: (entry: JournalEntry) => void;
  onVoid: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}

export function JournalEntriesTable({
  entries,
  accounts,
  isReadOnly,
  sortOrder,
  selectedQuarter,
  onSortOrderChange,
  onEdit,
  onVoid,
  onDelete,
}: JournalEntriesTableProps) {
  const sortedEntries = [...entries].sort((a, b) =>
    sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Asientos registrados</CardTitle>
          <Button variant="outline" size="sm" onClick={onSortOrderChange}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'asc' ? 'Más antiguo' : 'Más reciente'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Glosa</TableHead>
                <TableHead>Detalle</TableHead>
                {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay asientos registrados para {selectedQuarter}
                  </TableCell>
                </TableRow>
              ) : (
                sortedEntries.map(e => (
                  <React.Fragment key={e.id}>
                    <TableRow>
                      <TableCell className="font-mono">{e.id}</TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {e.lines.map((l, i) => {
                            const a = accounts.find(x => x.id === l.account_id);
                            return (
                              <div key={i} className="flex gap-2 items-center">
                                <AccountLabel accountId={l.account_id} accounts={accounts} line={l} />
                                <span className="flex-1">{a?.name}</span>
                                <span className="w-24 text-right">{l.debit ? fmt(l.debit) : ''}</span>
                                <span className="w-24 text-right">{l.credit ? fmt(l.credit) : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(e)}
                            title="Editar"
                            disabled={!!e.void_of}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onVoid(e)} title="Anular">
                            <Undo2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(e.id)} title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {e.memo && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground italic text-sm pl-8">
                          {e.memo}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
