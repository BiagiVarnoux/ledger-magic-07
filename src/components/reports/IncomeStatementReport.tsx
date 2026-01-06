// src/components/reports/IncomeStatementReport.tsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { PeriodSelector, PeriodType, getYearPeriod, isDateInYear, YearPeriod } from './PeriodSelector';
import { Account, JournalEntry } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { Quarter, isDateInQuarter, getCurrentQuarter } from '@/accounting/quarterly-utils';
import { exportIncomeStatementNIIFToPDF } from '@/services/pdfService';
import { useReportSettings } from '@/hooks/useReportSettings';

interface IncomeStatementReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: Quarter[];
  currentQuarter: Quarter;
}

interface AccountDetail {
  id: string;
  name: string;
  amount: number;
}

interface NIIFIncomeStatement {
  // Revenue
  ventas: AccountDetail[];
  totalVentas: number;
  
  // Cost of Sales
  costoVentas: AccountDetail[];
  totalCostoVentas: number;
  
  // Gross Profit
  utilidadBruta: number;
  margenBruto: number;
  
  // Operating Expenses
  gastosOperativos: AccountDetail[];
  totalGastosOperativos: number;
  
  // Operating Profit
  utilidadOperativa: number;
  margenOperativo: number;
  
  // Other Expenses
  otrosGastos: AccountDetail[];
  totalOtrosGastos: number;
  
  // Profit before tax
  utilidadAntesImpuestos: number;
  
  // Tax
  impuesto: number;
  tasaImpuesto: number;
  taxEnabled: boolean;
  
  // Net Profit
  utilidadNeta: number;
  margenNeto: number;
}

function classifyExpense(
  accountName: string, 
  costoKeywords: string[], 
  operativoKeywords: string[], 
  otrosKeywords: string[]
): 'costo' | 'operativo' | 'otro' {
  const lowerName = accountName.toLowerCase();
  
  // Check cost of sales first
  if (costoKeywords.some(k => lowerName.includes(k))) {
    return 'costo';
  }
  
  // Check other expenses (more specific)
  if (otrosKeywords.some(k => lowerName.includes(k))) {
    return 'otro';
  }
  
  // Default to operating expense
  return 'operativo';
}

export function IncomeStatementReport({
  accounts,
  entries,
  selectedQuarter,
  onQuarterChange,
  availableQuarters,
  currentQuarter,
}: IncomeStatementReportProps) {
  const { settings } = useReportSettings();
  const [periodType, setPeriodType] = useState<PeriodType>('quarterly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const currentYear = useMemo(() => getYearPeriod(selectedYear), [selectedYear]);

  const incomeStatement = useMemo<NIIFIncomeStatement>(() => {
    const ventasMap = new Map<string, AccountDetail>();
    const costoVentasMap = new Map<string, AccountDetail>();
    const gastosOperativosMap = new Map<string, AccountDetail>();
    const otrosGastosMap = new Map<string, AccountDetail>();

    // Initialize income accounts
    for (const a of accounts) {
      if (a.type === 'INGRESO') {
        ventasMap.set(a.id, { id: a.id, name: a.name, amount: 0 });
      }
      if (a.type === 'GASTO') {
        const classification = classifyExpense(
          a.name,
          settings.cost_of_sales_keywords,
          settings.operating_expense_keywords,
          settings.other_expense_keywords
        );
        
        const detail = { id: a.id, name: a.name, amount: 0 };
        switch (classification) {
          case 'costo':
            costoVentasMap.set(a.id, detail);
            break;
          case 'otro':
            otrosGastosMap.set(a.id, detail);
            break;
          default:
            gastosOperativosMap.set(a.id, detail);
        }
      }
    }

    // Filter entries by period
    const isInPeriod = (date: string) => {
      if (periodType === 'quarterly') {
        return isDateInQuarter(date, currentQuarter);
      }
      return isDateInYear(date, selectedYear);
    };

    // Calculate amounts from entries
    for (const e of entries) {
      if (!isInPeriod(e.date)) continue;
      
      for (const l of e.lines) {
        const a = accounts.find(x => x.id === l.account_id);
        if (!a) continue;

        if (a.type === 'INGRESO') {
          const acc = ventasMap.get(a.id);
          if (acc) acc.amount += l.credit - l.debit;
        }
        if (a.type === 'GASTO') {
          const amount = l.debit - l.credit;
          
          if (costoVentasMap.has(a.id)) {
            const acc = costoVentasMap.get(a.id)!;
            acc.amount += amount;
          } else if (otrosGastosMap.has(a.id)) {
            const acc = otrosGastosMap.get(a.id)!;
            acc.amount += amount;
          } else {
            const acc = gastosOperativosMap.get(a.id);
            if (acc) acc.amount += amount;
          }
        }
      }
    }

    // Filter non-zero and sort
    const filterAndSort = (map: Map<string, AccountDetail>) =>
      Array.from(map.values())
        .filter(x => x.amount !== 0)
        .sort((a, b) => a.id.localeCompare(b.id));

    const ventas = filterAndSort(ventasMap);
    const costoVentas = filterAndSort(costoVentasMap);
    const gastosOperativos = filterAndSort(gastosOperativosMap);
    const otrosGastos = filterAndSort(otrosGastosMap);

    const totalVentas = ventas.reduce((sum, x) => sum + x.amount, 0);
    const totalCostoVentas = costoVentas.reduce((sum, x) => sum + x.amount, 0);
    const totalGastosOperativos = gastosOperativos.reduce((sum, x) => sum + x.amount, 0);
    const totalOtrosGastos = otrosGastos.reduce((sum, x) => sum + x.amount, 0);

    const utilidadBruta = totalVentas - totalCostoVentas;
    const utilidadOperativa = utilidadBruta - totalGastosOperativos;
    const utilidadAntesImpuestos = utilidadOperativa - totalOtrosGastos;
    
    // Only apply tax for annual reports when enabled
    const taxEnabled = periodType === 'annual' && settings.tax_enabled;
    const impuesto = taxEnabled && utilidadAntesImpuestos > 0 
      ? utilidadAntesImpuestos * (settings.tax_rate / 100) 
      : 0;
    const utilidadNeta = utilidadAntesImpuestos - impuesto;

    const calcMargin = (value: number) => totalVentas > 0 ? (value / totalVentas) * 100 : 0;

    return {
      ventas,
      totalVentas,
      costoVentas,
      totalCostoVentas,
      utilidadBruta,
      margenBruto: calcMargin(utilidadBruta),
      gastosOperativos,
      totalGastosOperativos,
      utilidadOperativa,
      margenOperativo: calcMargin(utilidadOperativa),
      otrosGastos,
      totalOtrosGastos,
      utilidadAntesImpuestos,
      impuesto,
      tasaImpuesto: settings.tax_rate,
      taxEnabled,
      utilidadNeta,
      margenNeto: calcMargin(utilidadNeta),
    };
  }, [accounts, entries, currentQuarter, periodType, selectedYear, settings]);

  const handleExportPDF = () => {
    const periodLabel = periodType === 'quarterly' ? selectedQuarter : `Año ${selectedYear}`;
    exportIncomeStatementNIIFToPDF(incomeStatement, periodLabel);
  };

  const MarginIndicator = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600 inline ml-1" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600 inline ml-1" />;
    return <Minus className="h-4 w-4 text-muted-foreground inline ml-1" />;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Estado de Resultados (NIIF)</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right w-24">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* INGRESOS */}
              <TableRow className="bg-green-50 dark:bg-green-950/30">
                <TableCell colSpan={4} className="font-semibold text-green-700 dark:text-green-400">
                  INGRESOS POR VENTAS
                </TableCell>
              </TableRow>
              {incomeStatement.ventas.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-green-100 dark:bg-green-950/50">
                <TableCell colSpan={2} className="text-right font-semibold">Total Ingresos</TableCell>
                <TableCell className="text-right font-semibold">{fmt(incomeStatement.totalVentas)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>

              {/* COSTO DE VENTAS */}
              <TableRow className="bg-orange-50 dark:bg-orange-950/30">
                <TableCell colSpan={4} className="font-semibold text-orange-700 dark:text-orange-400">
                  (-) COSTO DE VENTAS
                </TableCell>
              </TableRow>
              {incomeStatement.costoVentas.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right text-red-600">({fmt(item.amount)})</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
              {incomeStatement.costoVentas.length > 0 && (
                <TableRow className="bg-orange-100 dark:bg-orange-950/50">
                  <TableCell colSpan={2} className="text-right font-semibold">Total Costo de Ventas</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">({fmt(incomeStatement.totalCostoVentas)})</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              )}

              {/* UTILIDAD BRUTA */}
              <TableRow className="bg-blue-100 dark:bg-blue-950/50 font-semibold">
                <TableCell colSpan={2} className="text-right font-bold">UTILIDAD BRUTA</TableCell>
                <TableCell className={`text-right font-bold ${incomeStatement.utilidadBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(incomeStatement.utilidadBruta)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {incomeStatement.margenBruto.toFixed(1)}%
                  <MarginIndicator value={incomeStatement.margenBruto} />
                </TableCell>
              </TableRow>

              {/* GASTOS OPERATIVOS */}
              <TableRow className="bg-purple-50 dark:bg-purple-950/30">
                <TableCell colSpan={4} className="font-semibold text-purple-700 dark:text-purple-400">
                  (-) GASTOS OPERATIVOS
                </TableCell>
              </TableRow>
              {incomeStatement.gastosOperativos.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right text-red-600">({fmt(item.amount)})</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
              {incomeStatement.gastosOperativos.length > 0 && (
                <TableRow className="bg-purple-100 dark:bg-purple-950/50">
                  <TableCell colSpan={2} className="text-right font-semibold">Total Gastos Operativos</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">({fmt(incomeStatement.totalGastosOperativos)})</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              )}

              {/* UTILIDAD OPERATIVA */}
              <TableRow className="bg-blue-100 dark:bg-blue-950/50 font-semibold">
                <TableCell colSpan={2} className="text-right font-bold">UTILIDAD OPERATIVA (EBIT)</TableCell>
                <TableCell className={`text-right font-bold ${incomeStatement.utilidadOperativa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(incomeStatement.utilidadOperativa)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {incomeStatement.margenOperativo.toFixed(1)}%
                  <MarginIndicator value={incomeStatement.margenOperativo} />
                </TableCell>
              </TableRow>

              {/* OTROS GASTOS */}
              {incomeStatement.otrosGastos.length > 0 && (
                <>
                  <TableRow className="bg-slate-50 dark:bg-slate-950/30">
                    <TableCell colSpan={4} className="font-semibold text-slate-700 dark:text-slate-400">
                      (-) OTROS GASTOS
                    </TableCell>
                  </TableRow>
                  {incomeStatement.otrosGastos.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right text-red-600">({fmt(item.amount)})</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-100 dark:bg-slate-950/50">
                    <TableCell colSpan={2} className="text-right font-semibold">Total Otros Gastos</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">({fmt(incomeStatement.totalOtrosGastos)})</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                </>
              )}

              {/* UTILIDAD ANTES DE IMPUESTOS */}
              <TableRow className="bg-amber-100 dark:bg-amber-950/50 font-semibold">
                <TableCell colSpan={2} className="text-right font-bold">UTILIDAD ANTES DE IMPUESTOS</TableCell>
                <TableCell className={`text-right font-bold ${incomeStatement.utilidadAntesImpuestos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(incomeStatement.utilidadAntesImpuestos)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
              </TableRow>

              {/* IMPUESTOS (solo para reportes anuales con impuesto habilitado) */}
              {incomeStatement.taxEnabled && (
                <TableRow>
                  <TableCell className="font-mono text-xs">—</TableCell>
                  <TableCell>(-) Impuesto a la Renta ({incomeStatement.tasaImpuesto}%)</TableCell>
                  <TableCell className="text-right text-red-600">({fmt(incomeStatement.impuesto)})</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              )}

              {/* UTILIDAD NETA */}
              <TableRow className="bg-muted font-bold">
                <TableCell colSpan={2} className="text-right text-lg font-bold">UTILIDAD NETA</TableCell>
                <TableCell className={`text-right text-lg font-bold ${incomeStatement.utilidadNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(incomeStatement.utilidadNeta)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {incomeStatement.margenNeto.toFixed(1)}%
                  <MarginIndicator value={incomeStatement.margenNeto} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Resumen de Márgenes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Margen Bruto</div>
              <div className={`text-2xl font-bold ${incomeStatement.margenBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {incomeStatement.margenBruto.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Margen Operativo</div>
              <div className={`text-2xl font-bold ${incomeStatement.margenOperativo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {incomeStatement.margenOperativo.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Margen Neto</div>
              <div className={`text-2xl font-bold ${incomeStatement.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {incomeStatement.margenNeto.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tax Notice */}
        {periodType === 'annual' && !settings.tax_enabled && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            💡 El cálculo de impuestos está deshabilitado. Puedes habilitarlo en Configuración → Impuestos.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
