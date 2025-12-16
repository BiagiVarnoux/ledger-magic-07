// src/components/reports/CashFlowReport.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { QuarterSelector } from './QuarterSelector';
import { Account, JournalEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { Quarter, isDateInQuarter } from '@/accounting/quarterly-utils';
import { exportCashFlowToPDF, CashFlowData } from '@/services/pdfService';

interface CashFlowReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: Quarter[];
  currentQuarter: Quarter;
}

// Heuristic to identify cash accounts
function isCashAccount(account: Account): boolean {
  const cashKeywords = ['banco', 'caja', 'efectivo', 'cash', 'usdt', 'usd', 'btc', 'cripto'];
  const lowerName = account.name.toLowerCase();
  return account.type === 'ACTIVO' && cashKeywords.some(k => lowerName.includes(k));
}

// Classify movement by activity type
function classifyMovement(account: Account): 'operacion' | 'inversion' | 'financiacion' {
  if (account.type === 'INGRESO' || account.type === 'GASTO') {
    return 'operacion';
  }
  if (account.type === 'PATRIMONIO') {
    return 'financiacion';
  }
  if (account.type === 'PASIVO') {
    // Short-term liabilities -> operation, long-term -> financing
    // For simplicity, we'll treat all liabilities as financing
    return 'financiacion';
  }
  // Non-cash assets -> investment
  return 'inversion';
}

export function CashFlowReport({
  accounts,
  entries,
  selectedQuarter,
  onQuarterChange,
  availableQuarters,
  currentQuarter,
}: CashFlowReportProps) {
  const cashFlowData = useMemo(() => {
    // Identify cash accounts
    const cashAccounts = accounts.filter(isCashAccount);
    const cashAccountIds = new Set(cashAccounts.map(a => a.id));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Calculate initial cash balance (before quarter start)
    const quarterStart = currentQuarter.startDate;
    let initialCashBalance = 0;
    
    for (const entry of entries) {
      if (entry.date >= quarterStart) continue;
      for (const line of entry.lines) {
        if (cashAccountIds.has(line.account_id)) {
          initialCashBalance += line.debit - line.credit;
        }
      }
    }

    // Track movements by activity
    const operacionDetalle: Array<{ id: string; name: string; amount: number }> = [];
    const inversionDetalle: Array<{ id: string; name: string; amount: number }> = [];
    const financiacionDetalle: Array<{ id: string; name: string; amount: number }> = [];

    // Process entries in the quarter
    for (const entry of entries) {
      if (!isDateInQuarter(entry.date, currentQuarter)) continue;
      
      // Find cash movements in this entry
      let cashMovement = 0;
      const nonCashLines: Array<{ account: Account; debit: number; credit: number }> = [];
      
      for (const line of entry.lines) {
        if (cashAccountIds.has(line.account_id)) {
          cashMovement += line.debit - line.credit;
        } else {
          const account = accountMap.get(line.account_id);
          if (account) {
            nonCashLines.push({ account, debit: line.debit, credit: line.credit });
          }
        }
      }

      // If there's a cash movement, classify it based on the counterpart accounts
      if (cashMovement !== 0 && nonCashLines.length > 0) {
        // Use the first non-cash account to classify the movement
        const mainCounterpart = nonCashLines[0];
        const activity = classifyMovement(mainCounterpart.account);
        
        const detailItem = {
          id: mainCounterpart.account.id,
          name: mainCounterpart.account.name,
          amount: cashMovement,
        };

        switch (activity) {
          case 'operacion':
            operacionDetalle.push(detailItem);
            break;
          case 'inversion':
            inversionDetalle.push(detailItem);
            break;
          case 'financiacion':
            financiacionDetalle.push(detailItem);
            break;
        }
      }
    }

    // Aggregate by account
    const aggregateByAccount = (items: Array<{ id: string; name: string; amount: number }>) => {
      const map = new Map<string, { id: string; name: string; amount: number }>();
      for (const item of items) {
        const existing = map.get(item.id);
        if (existing) {
          existing.amount += item.amount;
        } else {
          map.set(item.id, { ...item });
        }
      }
      return Array.from(map.values()).filter(i => i.amount !== 0).sort((a, b) => a.id.localeCompare(b.id));
    };

    const operacionAggregated = aggregateByAccount(operacionDetalle);
    const inversionAggregated = aggregateByAccount(inversionDetalle);
    const financiacionAggregated = aggregateByAccount(financiacionDetalle);

    const flujoOperacion = operacionAggregated.reduce((sum, i) => sum + i.amount, 0);
    const flujoInversion = inversionAggregated.reduce((sum, i) => sum + i.amount, 0);
    const flujoFinanciacion = financiacionAggregated.reduce((sum, i) => sum + i.amount, 0);
    const flujoNeto = flujoOperacion + flujoInversion + flujoFinanciacion;
    const finalCashBalance = initialCashBalance + flujoNeto;

    return {
      cashAccounts: cashAccounts.map(a => ({ id: a.id, name: a.name })),
      initialCashBalance,
      operacionDetalle: operacionAggregated,
      inversionDetalle: inversionAggregated,
      financiacionDetalle: financiacionAggregated,
      flujoOperacion,
      flujoInversion,
      flujoFinanciacion,
      flujoNeto,
      finalCashBalance,
    };
  }, [accounts, entries, currentQuarter]);

  const handleExportPDF = () => {
    const data: CashFlowData = {
      initialCashBalance: cashFlowData.initialCashBalance,
      operacionDetalle: cashFlowData.operacionDetalle,
      inversionDetalle: cashFlowData.inversionDetalle,
      financiacionDetalle: cashFlowData.financiacionDetalle,
      flujoOperacion: cashFlowData.flujoOperacion,
      flujoInversion: cashFlowData.flujoInversion,
      flujoFinanciacion: cashFlowData.flujoFinanciacion,
      flujoNeto: cashFlowData.flujoNeto,
      finalCashBalance: cashFlowData.finalCashBalance,
    };
    exportCashFlowToPDF(data, selectedQuarter);
  };

  const renderSection = (
    title: string,
    items: Array<{ id: string; name: string; amount: number }>,
    total: number,
    colorClass: string
  ) => (
    <div className="space-y-2">
      <h3 className={`font-semibold ${colorClass}`}>{title}</h3>
      {items.length > 0 ? (
        <Table>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={`${item.id}-${idx}`}>
                <TableCell className="font-mono text-xs w-20">{item.id}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.amount >= 0 ? '+' : ''}{fmt(item.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-medium text-right">Flujo Neto</TableCell>
              <TableCell className={`text-right font-semibold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {total >= 0 ? '+' : ''}{fmt(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground text-sm italic pl-4">Sin movimientos</p>
      )}
    </div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Estado de Flujo de Caja</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <QuarterSelector
          value={selectedQuarter}
          onChange={onQuarterChange}
          availableQuarters={availableQuarters}
          showPeriod
          currentQuarter={currentQuarter}
        />

        {/* Cash accounts identified */}
        {cashFlowData.cashAccounts.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Cuentas de efectivo: </span>
            {cashFlowData.cashAccounts.map(a => a.name).join(', ')}
          </div>
        )}

        {/* Initial Balance */}
        <div className="border rounded-lg p-4 bg-muted/20">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Saldo Inicial de Efectivo</span>
            <span className="font-mono text-lg">{fmt(cashFlowData.initialCashBalance)}</span>
          </div>
        </div>

        {/* Operating Activities */}
        {renderSection(
          'Actividades de Operación',
          cashFlowData.operacionDetalle,
          cashFlowData.flujoOperacion,
          'text-blue-600'
        )}

        {/* Investment Activities */}
        {renderSection(
          'Actividades de Inversión',
          cashFlowData.inversionDetalle,
          cashFlowData.flujoInversion,
          'text-purple-600'
        )}

        {/* Financing Activities */}
        {renderSection(
          'Actividades de Financiación',
          cashFlowData.financiacionDetalle,
          cashFlowData.flujoFinanciacion,
          'text-orange-600'
        )}

        {/* Net Cash Flow */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Flujo Neto Total</span>
            <span className={`font-mono text-lg font-bold ${cashFlowData.flujoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {cashFlowData.flujoNeto >= 0 ? '+' : ''}{fmt(cashFlowData.flujoNeto)}
            </span>
          </div>
        </div>

        {/* Final Balance */}
        <div className="border rounded-lg p-4 bg-primary/10">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Saldo Final de Efectivo</span>
            <span className="font-mono text-xl font-bold">{fmt(cashFlowData.finalCashBalance)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Verificación: {fmt(cashFlowData.initialCashBalance)} + {fmt(cashFlowData.flujoNeto)} = {fmt(cashFlowData.finalCashBalance)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
