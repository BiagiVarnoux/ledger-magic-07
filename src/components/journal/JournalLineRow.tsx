// src/components/journal/JournalLineRow.tsx
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { AccountCombobox } from './AccountCombobox';
import { AccountLabel } from './AccountLabel';
import { Account } from '@/accounting/types';
import { LineDraft } from '@/hooks/useJournalForm';

interface JournalLineRowProps {
  line: LineDraft;
  index: number;
  accounts: Account[];
  showLineMemos: boolean;
  onAccountChange: (index: number, accountId: string) => void;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onRemoveLine: (index: number) => void;
}

export function JournalLineRow({
  line,
  index,
  accounts,
  showLineMemos,
  onAccountChange,
  onLineChange,
  onRemoveLine,
}: JournalLineRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <AccountCombobox
            value={line.account_id || ''}
            onChange={(v) => onAccountChange(index, v)}
            accounts={accounts}
          />
          {line.account_id && <AccountLabel accountId={line.account_id} accounts={accounts} line={line} />}
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={line.debit || ''}
          onChange={e => onLineChange(index, { debit: e.target.value, credit: '' })}
          disabled={!!line.credit}
          placeholder="0,00"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={line.credit || ''}
          onChange={e => onLineChange(index, { credit: e.target.value, debit: '' })}
          disabled={!!line.debit}
          placeholder="0,00"
        />
      </TableCell>
      {showLineMemos && (
        <TableCell>
          <Input
            value={line.line_memo || ''}
            onChange={e => onLineChange(index, { line_memo: e.target.value })}
          />
        </TableCell>
      )}
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemoveLine(index)}
          title="Eliminar fila"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
