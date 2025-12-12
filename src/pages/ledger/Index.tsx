// src/pages/ledger/Index.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { useAccounting } from '@/accounting/AccountingProvider';
import { cmpDate, signedBalanceFor, fmt } from '@/accounting/utils';
import { getCurrentQuarter, getAllQuartersFromStart, parseQuarterString, isDateInQuarter, getPreviousQuarter } from '@/accounting/quarterly-utils';
import { exportLedgerToCSV, LedgerRow } from '@/services/exportService';

export default function LedgerPage() {
  const { accounts, entries, adapter } = useAccounting();
  const [ledgerAccount, setLedgerAccount] = useState<string>('A.1');
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter().label);
  
  // Available quarters for selection
  const availableQuarters = useMemo(() => getAllQuartersFromStart(2020), []);
  const currentQuarter = useMemo(() => parseQuarterString(selectedQuarter), [selectedQuarter]);

  // Ledger data with quarterly support
  const [ledgerState, setLedgerState] = useState<{
    rows: LedgerRow[];
    opening: number;
    closing: number;
  }>({ rows: [], opening: 0, closing: 0 });

  const ledgerData = useMemo(async () => {
    const acc = accounts.find(a => a.id === ledgerAccount);
    if (!acc) return { rows: [], opening: 0, closing: 0 };

    // Get previous quarter's closing balance
    const previousQuarter = getPreviousQuarter(currentQuarter.year, currentQuarter.quarter);
    let initialBalance = 0;
    
    try {
      const closingBalances = await adapter.loadClosingBalances(previousQuarter.endDate);
      initialBalance = closingBalances[ledgerAccount] || 0;
    } catch (error) {
      console.error('Error loading closing balances:', error);
      // Calculate initial balance manually if closure doesn't exist
      entries.forEach(entry => {
        if (entry.date < currentQuarter.startDate) {
          entry.lines.forEach(line => {
            if (line.account_id === ledgerAccount) {
              initialBalance += signedBalanceFor(line.debit, line.credit, acc.normal_side);
            }
          });
        }
      });
    }

    // Filter entries for current quarter
    const inRange = entries
      .filter(e => isDateInQuarter(e.date, currentQuarter))
      .flatMap(e => e.lines.map(l => ({ e, l })))
      .filter(x => x.l.account_id === ledgerAccount)
      .sort((a, b) => cmpDate(a.e.date, b.e.date));

    // Build ledger entries with running balance
    let running = initialBalance;
    const rows: LedgerRow[] = inRange.map(({ e, l }) => {
      const delta = signedBalanceFor(l.debit, l.credit, acc.normal_side);
      running += delta;
      return {
        date: e.date,
        id: e.id,
        memo: e.memo || '',
        debit: l.debit,
        credit: l.credit,
        balance: running
      };
    });
    
    return { rows, opening: initialBalance, closing: running };
  }, [accounts, entries, ledgerAccount, currentQuarter, adapter]);

  // Handle async ledger data
  useEffect(() => {
    ledgerData.then(setLedgerState);
  }, [ledgerData]);

  function handleExport() {
    exportLedgerToCSV(
      ledgerState.rows,
      ledgerAccount,
      selectedQuarter,
      ledgerState.opening,
      ledgerState.closing
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro Mayor</h1>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Mayor
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Libro Mayor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <Label>Cuenta</Label>
              <Select value={ledgerAccount} onValueChange={setLedgerAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {accounts.map(a => 
                    <SelectItem key={a.id} value={a.id}>
                      {a.id} — {a.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trimestre:</Label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar trimestre" />
                </SelectTrigger>
                <SelectContent>
                  {availableQuarters.map((quarter) => (
                    <SelectItem key={`${quarter.year}-Q${quarter.quarter}`} value={quarter.label}>
                      {quarter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 text-right">
              <div className="text-sm text-muted-foreground">
                Saldo inicial: <span className="font-semibold">{fmt(ledgerState.opening)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Saldo final: <span className="font-semibold">{fmt(ledgerState.closing)}</span>
              </div>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Asiento</TableHead>
                  <TableHead>Glosa</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Saldo Inicial
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(ledgerState.opening)}
                  </TableCell>
                </TableRow>
                {ledgerState.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay movimientos en el trimestre seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerState.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell>{r.memo}</TableCell>
                    <TableCell className="text-right">
                      {r.debit ? fmt(r.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.credit ? fmt(r.credit) : ''}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(r.balance)}
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
