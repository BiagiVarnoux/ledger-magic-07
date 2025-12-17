// src/components/reports/IncomeStatementReport.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { QuarterSelector } from './QuarterSelector';
import { Account, JournalEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { Quarter, isDateInQuarter } from '@/accounting/quarterly-utils';
import { exportIncomeStatementToPDF } from '@/services/pdfService';

interface IncomeStatementReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: Quarter[];
  currentQuarter: Quarter;
}

export function IncomeStatementReport({
  accounts,
  entries,
  selectedQuarter,
  onQuarterChange,
  availableQuarters,
  currentQuarter,
}: IncomeStatementReportProps) {
  const incomeStatement = useMemo(() => {
    const ingresosMap = new Map<string, { id: string; name: string; amount: number }>();
    const gastosMap = new Map<string, { id: string; name: string; amount: number }>();

    for (const a of accounts) {
      if (a.type === 'INGRESO') {
        ingresosMap.set(a.id, { id: a.id, name: a.name, amount: 0 });
      }
      if (a.type === 'GASTO') {
        gastosMap.set(a.id, { id: a.id, name: a.name, amount: 0 });
      }
    }

    for (const e of entries) {
      if (!isDateInQuarter(e.date, currentQuarter)) continue;
      for (const l of e.lines) {
        const a = accounts.find(x => x.id === l.account_id);
        if (!a) continue;

        if (a.type === 'INGRESO') {
          const acc = ingresosMap.get(a.id);
          if (acc) acc.amount += l.credit - l.debit;
        }
        if (a.type === 'GASTO') {
          const acc = gastosMap.get(a.id);
          if (acc) acc.amount += l.debit - l.credit;
        }
      }
    }

    const ingresosDetalle = Array.from(ingresosMap.values())
      .filter(x => x.amount !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const gastosDetalle = Array.from(gastosMap.values())
      .filter(x => x.amount !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));

    const ingresos = ingresosDetalle.reduce((sum, x) => sum + x.amount, 0);
    const gastos = gastosDetalle.reduce((sum, x) => sum + x.amount, 0);

    return {
      ingresosDetalle,
      gastosDetalle,
      ingresos,
      gastos,
      utilidad: ingresos - gastos,
    };
  }, [accounts, entries, currentQuarter]);

  const handleExportPDF = () => {
    exportIncomeStatementToPDF(incomeStatement, selectedQuarter);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Estado de Resultados</CardTitle>
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
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Ingresos */}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={3} className="font-semibold">
                  INGRESOS
                </TableCell>
              </TableRow>
              {incomeStatement.ingresosDetalle.map(ing => (
                <TableRow key={ing.id}>
                  <TableCell className="font-mono">{ing.id}</TableCell>
                  <TableCell>{ing.name}</TableCell>
                  <TableCell className="text-right">{fmt(ing.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="text-right font-semibold">
                  Total Ingresos
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(incomeStatement.ingresos)}</TableCell>
              </TableRow>

              {/* Gastos */}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={3} className="font-semibold">
                  GASTOS
                </TableCell>
              </TableRow>
              {incomeStatement.gastosDetalle.map(gst => (
                <TableRow key={gst.id}>
                  <TableCell className="font-mono">{gst.id}</TableCell>
                  <TableCell>{gst.name}</TableCell>
                  <TableCell className="text-right">{fmt(gst.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="text-right font-semibold">
                  Total Gastos
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(incomeStatement.gastos)}</TableCell>
              </TableRow>

              {/* Utilidad Neta */}
              <TableRow className="bg-muted">
                <TableCell colSpan={2} className="text-right font-bold">
                  UTILIDAD NETA
                </TableCell>
                <TableCell className="text-right font-bold">{fmt(incomeStatement.utilidad)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
