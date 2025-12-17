// src/components/reports/BalanceSheetReport.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { Account, JournalEntry } from '@/accounting/types';
import { signedBalanceFor, fmt } from '@/accounting/utils';
import { exportBalanceSheetToPDF } from '@/services/pdfService';

interface BalanceSheetReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  bsDate: string;
  onBsDateChange: (date: string) => void;
}

export function BalanceSheetReport({
  accounts,
  entries,
  bsDate,
  onBsDateChange,
}: BalanceSheetReportProps) {
  const balanceSheet = useMemo(() => {
    const activosMap = new Map<string, { id: string; name: string; balance: number }>();
    const pasivosMap = new Map<string, { id: string; name: string; balance: number }>();
    const patrimonioMap = new Map<string, { id: string; name: string; balance: number }>();

    // Initialize accounts
    for (const a of accounts) {
      if (a.type === 'ACTIVO') {
        activosMap.set(a.id, { id: a.id, name: a.name, balance: 0 });
      }
      if (a.type === 'PASIVO') {
        pasivosMap.set(a.id, { id: a.id, name: a.name, balance: 0 });
      }
      if (a.type === 'PATRIMONIO') {
        patrimonioMap.set(a.id, { id: a.id, name: a.name, balance: 0 });
      }
    }

    // Calculate balances per account until bsDate
    for (const a of accounts) {
      let bal = 0;
      for (const e of entries) {
        if (e.date > bsDate) continue;
        for (const l of e.lines) {
          if (l.account_id !== a.id) continue;
          bal += signedBalanceFor(l.debit, l.credit, a.normal_side);
        }
      }

      if (a.type === 'ACTIVO') {
        const acc = activosMap.get(a.id);
        if (acc) acc.balance = bal;
      }
      if (a.type === 'PASIVO') {
        const acc = pasivosMap.get(a.id);
        if (acc) acc.balance = bal;
      }
      if (a.type === 'PATRIMONIO') {
        const acc = patrimonioMap.get(a.id);
        if (acc) acc.balance = bal;
      }
    }

    // Accumulated profit (income - expenses) until bsDate
    let ingresos = 0,
      gastos = 0;
    for (const e of entries) {
      if (e.date > bsDate) continue;
      for (const l of e.lines) {
        const a = accounts.find(x => x.id === l.account_id);
        if (!a) continue;
        if (a.type === 'INGRESO') {
          ingresos += l.credit - l.debit;
        }
        if (a.type === 'GASTO') {
          gastos += l.debit - l.credit;
        }
      }
    }
    const utilidadAcumulada = ingresos - gastos;

    // Filter accounts with non-zero balance
    const activosDetalle = Array.from(activosMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const pasivosDetalle = Array.from(pasivosMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const patrimonioDetalle = Array.from(patrimonioMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));

    // Totals
    const totalActivo = activosDetalle.reduce((sum, x) => sum + x.balance, 0);
    const totalPasivo = pasivosDetalle.reduce((sum, x) => sum + x.balance, 0);
    const totalPatrimonioContable = patrimonioDetalle.reduce((sum, x) => sum + x.balance, 0);
    const totalPatrimonio = totalPatrimonioContable + utilidadAcumulada;

    return {
      activosDetalle,
      pasivosDetalle,
      patrimonioDetalle,
      utilidadAcumulada,
      totalActivo,
      totalPasivo,
      totalPatrimonioContable,
      totalPatrimonio,
      check: +(totalActivo - (totalPasivo + totalPatrimonio)).toFixed(2),
    };
  }, [accounts, entries, bsDate]);

  const handleExportPDF = () => {
    exportBalanceSheetToPDF({
      activosDetalle: balanceSheet.activosDetalle,
      pasivosDetalle: balanceSheet.pasivosDetalle,
      patrimonioDetalle: balanceSheet.patrimonioDetalle,
      utilidadAcumulada: balanceSheet.utilidadAcumulada,
      totalActivo: balanceSheet.totalActivo,
      totalPasivo: balanceSheet.totalPasivo,
      totalPatrimonio: balanceSheet.totalPatrimonio,
    }, bsDate);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Balance General</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full max-w-xs">
          <Label>Fecha de corte:</Label>
          <Input type="date" value={bsDate} onChange={e => onBsDateChange(e.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">Al: {bsDate}</div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: ASSETS */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="font-semibold">
                    ACTIVOS
                  </TableCell>
                </TableRow>
                {balanceSheet.activosDetalle.map(act => (
                  <TableRow key={act.id}>
                    <TableCell className="font-mono text-xs">{act.id}</TableCell>
                    <TableCell className="text-sm">{act.name}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(act.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted">
                  <TableCell colSpan={2} className="text-right font-bold">
                    Total Activos
                  </TableCell>
                  <TableCell className="text-right font-bold">{fmt(balanceSheet.totalActivo)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Right Column: LIABILITIES + EQUITY */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* LIABILITIES */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="font-semibold">
                    PASIVOS
                  </TableCell>
                </TableRow>
                {balanceSheet.pasivosDetalle.map(pas => (
                  <TableRow key={pas.id}>
                    <TableCell className="font-mono text-xs">{pas.id}</TableCell>
                    <TableCell className="text-sm">{pas.name}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(pas.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="text-right font-semibold">
                    Total Pasivos
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(balanceSheet.totalPasivo)}</TableCell>
                </TableRow>

                {/* EQUITY */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="font-semibold">
                    PATRIMONIO
                  </TableCell>
                </TableRow>
                {balanceSheet.patrimonioDetalle.map(pat => (
                  <TableRow key={pat.id}>
                    <TableCell className="font-mono text-xs">{pat.id}</TableCell>
                    <TableCell className="text-sm">{pat.name}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(pat.balance)}</TableCell>
                  </TableRow>
                ))}
                {/* Accumulated Profit */}
                <TableRow>
                  <TableCell className="font-mono text-xs">—</TableCell>
                  <TableCell className="font-medium text-sm">Utilidad/Pérdida Acumulada</TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {fmt(balanceSheet.utilidadAcumulada)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="text-right font-semibold">
                    Total Patrimonio
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(balanceSheet.totalPatrimonio)}</TableCell>
                </TableRow>

                {/* Total Liabilities + Equity */}
                <TableRow className="bg-muted">
                  <TableCell colSpan={2} className="text-right font-bold">
                    Total Pasivo + Patrimonio
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(balanceSheet.totalPasivo + balanceSheet.totalPatrimonio)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div
          className={'text-sm font-medium ' + (balanceSheet.check === 0 ? 'text-green-600' : 'text-red-600')}
        >
          Chequeo contable: Activos - (Pasivo + Patrimonio) ={' '}
          <span className="font-semibold">{fmt(balanceSheet.check)}</span>
          {balanceSheet.check === 0 ? ' ✓ Cuadra' : ' ✗ No cuadra'}
        </div>
      </CardContent>
    </Card>
  );
}
