// src/components/reports/TrialBalanceReport.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { QuarterSelector } from './QuarterSelector';
import { Account, JournalEntry, AccountType, Side } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { Quarter, isDateInQuarter } from '@/accounting/quarterly-utils';
import { exportTrialBalanceToPDF } from '@/services/pdfService';

interface TrialBalanceReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: Quarter[];
  currentQuarter: Quarter;
}

export function TrialBalanceReport({
  accounts,
  entries,
  selectedQuarter,
  onQuarterChange,
  availableQuarters,
  currentQuarter,
}: TrialBalanceReportProps) {
  const trialRows = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      type: AccountType;
      side: Side;
      debit: number;
      credit: number;
    }>();

    for (const a of accounts) {
      map.set(a.id, {
        id: a.id,
        name: a.name,
        type: a.type,
        side: a.normal_side,
        debit: 0,
        credit: 0,
      });
    }

    for (const e of entries) {
      if (!isDateInQuarter(e.date, currentQuarter)) continue;
      for (const l of e.lines) {
        const r = map.get(l.account_id);
        if (!r) continue;
        r.debit += l.debit;
        r.credit += l.credit;
      }
    }

    const rows = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
    const totals = rows.reduce(
      (t, r) => {
        t.debit += r.debit;
        t.credit += r.credit;
        return t;
      },
      { debit: 0, credit: 0 }
    );

    return { rows, totals };
  }, [accounts, entries, currentQuarter]);

  const handleExportPDF = () => {
    const pdfRows = trialRows.rows.map(r => ({
      id: r.id,
      name: r.name,
      debit: r.debit,
      credit: r.credit,
      balance: r.side === 'DEBE' ? r.debit - r.credit : r.credit - r.debit,
    }));
    exportTrialBalanceToPDF(pdfRows, trialRows.totals, selectedQuarter);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Balance de Comprobación</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <QuarterSelector
          value={selectedQuarter}
          onChange={onQuarterChange}
          availableQuarters={availableQuarters}
          showPeriod
          currentQuarter={currentQuarter}
        />
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trialRows.rows.map(r => {
                const saldo = r.side === 'DEBE' ? r.debit - r.credit : r.credit - r.debit;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.debit ? fmt(r.debit) : ''}</TableCell>
                    <TableCell className="text-right">{r.credit ? fmt(r.credit) : ''}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(saldo)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="text-right font-semibold">
                  Totales
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(trialRows.totals.debit)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(trialRows.totals.credit)}</TableCell>
                <TableCell className="text-right font-semibold">
                  {fmt(trialRows.totals.debit - trialRows.totals.credit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
