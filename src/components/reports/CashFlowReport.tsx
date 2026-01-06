// src/components/reports/CashFlowReport.tsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { PeriodSelector, PeriodType, getYearPeriod, isDateInYear, YearPeriod } from './PeriodSelector';
import { Account, JournalEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { Quarter, isDateInQuarter } from '@/accounting/quarterly-utils';
import { exportCashFlowNIIFToPDF, CashFlowNIIFData } from '@/services/pdfService';

interface CashFlowReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: Quarter[];
  currentQuarter: Quarter;
}

// Heuristic to identify cash accounts (NIC 7 - Cash and cash equivalents)
function isCashAccount(account: Account): boolean {
  const cashKeywords = ['banco', 'caja', 'efectivo', 'cash', 'usdt', 'usd', 'btc', 'cripto', 'equivalente'];
  const lowerName = account.name.toLowerCase();
  return account.type === 'ACTIVO' && cashKeywords.some(k => lowerName.includes(k));
}

// Classify movement by activity type according to NIC 7
function classifyMovementNIC7(
  account: Account,
  allAccounts: Account[]
): 'operacion' | 'inversion' | 'financiacion' {
  const lowerName = account.name.toLowerCase();
  
  // Operating Activities (NIC 7.14-20)
  // - Revenue and expense accounts
  // - Trade receivables and payables
  // - Inventory changes
  if (account.type === 'INGRESO' || account.type === 'GASTO') {
    return 'operacion';
  }
  
  // Check for operating assets/liabilities
  const operatingKeywords = [
    'cobrar', 'pagar', 'inventario', 'mercaderia', 'mercadería', 
    'iva', 'impuesto', 'anticipo', 'prepago', 'diferido'
  ];
  if (operatingKeywords.some(k => lowerName.includes(k))) {
    return 'operacion';
  }
  
  // Financing Activities (NIC 7.17)
  // - Capital changes
  // - Loans and borrowings
  // - Dividends
  if (account.type === 'PATRIMONIO') {
    return 'financiacion';
  }
  
  const financingKeywords = [
    'capital', 'préstamo', 'prestamo', 'deuda', 'dividendo', 
    'aporte', 'accionista', 'reserva', 'utilidades retenidas'
  ];
  if (financingKeywords.some(k => lowerName.includes(k))) {
    return 'financiacion';
  }
  
  // Liabilities - more specific classification
  if (account.type === 'PASIVO') {
    // Long-term debt -> financing
    if (lowerName.includes('largo plazo') || lowerName.includes('préstamo') || lowerName.includes('prestamo')) {
      return 'financiacion';
    }
    // Trade payables -> operating
    return 'operacion';
  }
  
  // Investment Activities (NIC 7.16)
  // - Fixed assets acquisition/disposal
  // - Investments in securities
  // - Loans to third parties
  const investmentKeywords = [
    'fijo', 'propiedad', 'planta', 'equipo', 'maquinaria', 
    'vehiculo', 'vehículo', 'edificio', 'terreno', 'inversion', 
    'inversión', 'intangible', 'activo no corriente'
  ];
  if (investmentKeywords.some(k => lowerName.includes(k))) {
    return 'inversion';
  }
  
  // Non-cash assets default to investment
  return 'inversion';
}

interface CashFlowItem {
  id: string;
  name: string;
  amount: number;
}

interface CashFlowDataNIIF {
  cashAccounts: Array<{ id: string; name: string }>;
  initialCashBalance: number;
  
  // Operating Activities (Método Directo simplificado)
  operacionDetalle: CashFlowItem[];
  flujoOperacion: number;
  
  // Investment Activities
  inversionDetalle: CashFlowItem[];
  flujoInversion: number;
  
  // Financing Activities
  financiacionDetalle: CashFlowItem[];
  flujoFinanciacion: number;
  
  // Totals
  flujoNeto: number;
  finalCashBalance: number;
  
  // Ratios
  ratioCobertura: number | null; // Operating Cash Flow / Current Liabilities
}

export function CashFlowReport({
  accounts,
  entries,
  selectedQuarter,
  onQuarterChange,
  availableQuarters,
  currentQuarter,
}: CashFlowReportProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('quarterly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const currentYear = useMemo(() => getYearPeriod(selectedYear), [selectedYear]);

  const cashFlowData = useMemo<CashFlowDataNIIF>(() => {
    const cashAccounts = accounts.filter(isCashAccount);
    const cashAccountIds = new Set(cashAccounts.map(a => a.id));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Filter entries by period
    const isInPeriod = (date: string) => {
      if (periodType === 'quarterly') {
        return isDateInQuarter(date, currentQuarter);
      }
      return isDateInYear(date, selectedYear);
    };

    const getPeriodStart = () => {
      if (periodType === 'quarterly') {
        return currentQuarter.startDate;
      }
      return `${selectedYear}-01-01`;
    };

    const periodStart = getPeriodStart();

    // Calculate initial cash balance (before period start)
    let initialCashBalance = 0;
    for (const entry of entries) {
      if (entry.date >= periodStart) continue;
      for (const line of entry.lines) {
        if (cashAccountIds.has(line.account_id)) {
          initialCashBalance += line.debit - line.credit;
        }
      }
    }

    // Track movements by activity
    const operacionItems: CashFlowItem[] = [];
    const inversionItems: CashFlowItem[] = [];
    const financiacionItems: CashFlowItem[] = [];

    // Process entries in the period
    for (const entry of entries) {
      if (!isInPeriod(entry.date)) continue;
      
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
        const mainCounterpart = nonCashLines[0];
        const activity = classifyMovementNIC7(mainCounterpart.account, accounts);
        
        const detailItem: CashFlowItem = {
          id: mainCounterpart.account.id,
          name: mainCounterpart.account.name,
          amount: cashMovement,
        };

        switch (activity) {
          case 'operacion':
            operacionItems.push(detailItem);
            break;
          case 'inversion':
            inversionItems.push(detailItem);
            break;
          case 'financiacion':
            financiacionItems.push(detailItem);
            break;
        }
      }
    }

    // Aggregate by account
    const aggregateByAccount = (items: CashFlowItem[]): CashFlowItem[] => {
      const map = new Map<string, CashFlowItem>();
      for (const item of items) {
        const existing = map.get(item.id);
        if (existing) {
          existing.amount += item.amount;
        } else {
          map.set(item.id, { ...item });
        }
      }
      return Array.from(map.values())
        .filter(i => i.amount !== 0)
        .sort((a, b) => a.id.localeCompare(b.id));
    };

    const operacionDetalle = aggregateByAccount(operacionItems);
    const inversionDetalle = aggregateByAccount(inversionItems);
    const financiacionDetalle = aggregateByAccount(financiacionItems);

    const flujoOperacion = operacionDetalle.reduce((sum, i) => sum + i.amount, 0);
    const flujoInversion = inversionDetalle.reduce((sum, i) => sum + i.amount, 0);
    const flujoFinanciacion = financiacionDetalle.reduce((sum, i) => sum + i.amount, 0);
    const flujoNeto = flujoOperacion + flujoInversion + flujoFinanciacion;
    const finalCashBalance = initialCashBalance + flujoNeto;

    // Calculate ratio (Operating Cash Flow / Current Liabilities at period end)
    // For simplicity, we use total liabilities as a proxy
    let totalLiabilities = 0;
    for (const account of accounts) {
      if (account.type === 'PASIVO') {
        let balance = 0;
        for (const entry of entries) {
          if (entry.date > (periodType === 'quarterly' ? currentQuarter.endDate : `${selectedYear}-12-31`)) continue;
          for (const line of entry.lines) {
            if (line.account_id === account.id) {
              balance += line.credit - line.debit;
            }
          }
        }
        totalLiabilities += balance;
      }
    }
    
    const ratioCobertura = totalLiabilities > 0 ? flujoOperacion / totalLiabilities : null;

    return {
      cashAccounts: cashAccounts.map(a => ({ id: a.id, name: a.name })),
      initialCashBalance,
      operacionDetalle,
      flujoOperacion,
      inversionDetalle,
      flujoInversion,
      financiacionDetalle,
      flujoFinanciacion,
      flujoNeto,
      finalCashBalance,
      ratioCobertura,
    };
  }, [accounts, entries, currentQuarter, periodType, selectedYear]);

  const handleExportPDF = () => {
    const periodLabel = periodType === 'quarterly' ? selectedQuarter : `Año ${selectedYear}`;
    const pdfData: CashFlowNIIFData = {
      initialCashBalance: cashFlowData.initialCashBalance,
      operacionDetalle: cashFlowData.operacionDetalle,
      flujoOperacion: cashFlowData.flujoOperacion,
      inversionDetalle: cashFlowData.inversionDetalle,
      flujoInversion: cashFlowData.flujoInversion,
      financiacionDetalle: cashFlowData.financiacionDetalle,
      flujoFinanciacion: cashFlowData.flujoFinanciacion,
      flujoNeto: cashFlowData.flujoNeto,
      finalCashBalance: cashFlowData.finalCashBalance,
      ratioCobertura: cashFlowData.ratioCobertura,
    };
    exportCashFlowNIIFToPDF(pdfData, periodLabel);
  };

  const renderSection = (
    title: string,
    subtitle: string,
    items: CashFlowItem[],
    total: number,
    colorClass: string,
    bgClass: string
  ) => (
    <div className="space-y-2">
      <div className={`${bgClass} p-3 rounded-lg`}>
        <h3 className={`font-semibold ${colorClass}`}>{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
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
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Estado de Flujo de Efectivo (NIC 7)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Método Directo</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <PeriodSelector
          periodType={periodType}
          onPeriodTypeChange={setPeriodType}
          selectedQuarter={selectedQuarter}
          onQuarterChange={onQuarterChange}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableQuarters={availableQuarters}
          currentQuarter={currentQuarter}
          currentYear={currentYear}
        />

        {/* Cash accounts identified */}
        {cashFlowData.cashAccounts.length > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <span className="font-medium">Efectivo y equivalentes: </span>
            {cashFlowData.cashAccounts.map(a => a.name).join(', ')}
          </div>
        )}

        {/* Initial Balance */}
        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Saldo Inicial de Efectivo</span>
            <span className="font-mono text-lg">{fmt(cashFlowData.initialCashBalance)}</span>
          </div>
        </div>

        {/* Operating Activities (NIC 7.14-20) */}
        {renderSection(
          'Actividades de Operación',
          'Actividades principales que producen ingresos (NIC 7.14-20)',
          cashFlowData.operacionDetalle,
          cashFlowData.flujoOperacion,
          'text-blue-700 dark:text-blue-400',
          'bg-blue-50 dark:bg-blue-950/30'
        )}

        {/* Investment Activities (NIC 7.16) */}
        {renderSection(
          'Actividades de Inversión',
          'Adquisición y disposición de activos a largo plazo (NIC 7.16)',
          cashFlowData.inversionDetalle,
          cashFlowData.flujoInversion,
          'text-purple-700 dark:text-purple-400',
          'bg-purple-50 dark:bg-purple-950/30'
        )}

        {/* Financing Activities (NIC 7.17) */}
        {renderSection(
          'Actividades de Financiación',
          'Cambios en capital y préstamos (NIC 7.17)',
          cashFlowData.financiacionDetalle,
          cashFlowData.flujoFinanciacion,
          'text-orange-700 dark:text-orange-400',
          'bg-orange-50 dark:bg-orange-950/30'
        )}

        {/* Net Cash Flow */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Variación Neta de Efectivo</span>
            <span className={`font-mono text-lg font-bold flex items-center gap-2 ${cashFlowData.flujoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {cashFlowData.flujoNeto >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
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

        {/* Financial Ratios */}
        {cashFlowData.ratioCobertura !== null && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Ratio de Cobertura de Efectivo</div>
                <div className={`text-2xl font-bold ${cashFlowData.ratioCobertura >= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                  {cashFlowData.ratioCobertura.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Flujo Operativo / Pasivos
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Crecimiento de Efectivo</div>
                <div className={`text-2xl font-bold ${cashFlowData.flujoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlowData.initialCashBalance > 0 
                    ? `${((cashFlowData.flujoNeto / cashFlowData.initialCashBalance) * 100).toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  vs Saldo Inicial
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
