// src/components/reports/BalanceSheetReport.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Account, JournalEntry } from '@/accounting/types';
import { signedBalanceFor, fmt } from '@/accounting/utils';
import { exportBalanceSheetNIIFToPDF, BalanceSheetNIIFData } from '@/services/pdfService';

interface BalanceSheetReportProps {
  accounts: Account[];
  entries: JournalEntry[];
  bsDate: string;
  onBsDateChange: (date: string) => void;
}

interface AccountBalance {
  id: string;
  name: string;
  balance: number;
}

// Classify assets/liabilities as current or non-current based on name heuristics
function isCurrentAsset(name: string): boolean {
  const currentKeywords = [
    'caja', 'banco', 'efectivo', 'cobrar', 'inventario', 'mercaderia', 'mercadería',
    'anticipo', 'prepago', 'iva', 'crédito fiscal', 'credito fiscal', 'usdt', 'cripto'
  ];
  const lowerName = name.toLowerCase();
  return currentKeywords.some(k => lowerName.includes(k));
}

function isCurrentLiability(name: string): boolean {
  const currentKeywords = [
    'pagar', 'proveedor', 'acreedor', 'iva', 'débito fiscal', 'debito fiscal',
    'impuesto', 'sueldo', 'salario', 'corto plazo', 'anticipo'
  ];
  const lowerName = name.toLowerCase();
  return currentKeywords.some(k => lowerName.includes(k));
}

interface BalanceSheetNIIF {
  // Current Assets
  activosCorrientes: AccountBalance[];
  totalActivosCorrientes: number;
  
  // Non-Current Assets
  activosNoCorrientes: AccountBalance[];
  totalActivosNoCorrientes: number;
  
  totalActivo: number;
  
  // Current Liabilities
  pasivosCorrientes: AccountBalance[];
  totalPasivosCorrientes: number;
  
  // Non-Current Liabilities
  pasivosNoCorrientes: AccountBalance[];
  totalPasivosNoCorrientes: number;
  
  totalPasivo: number;
  
  // Equity
  patrimonioDetalle: AccountBalance[];
  utilidadAcumulada: number;
  totalPatrimonio: number;
  
  // Verification
  check: number;
  
  // Financial Ratios
  razonCorriente: number | null;
  razonEndeudamiento: number;
  capitalTrabajo: number;
}

export function BalanceSheetReport({
  accounts,
  entries,
  bsDate,
  onBsDateChange,
}: BalanceSheetReportProps) {
  const balanceSheet = useMemo<BalanceSheetNIIF>(() => {
    const activosCorrientesMap = new Map<string, AccountBalance>();
    const activosNoCorrientesMap = new Map<string, AccountBalance>();
    const pasivosCorrientesMap = new Map<string, AccountBalance>();
    const pasivosNoCorrientesMap = new Map<string, AccountBalance>();
    const patrimonioMap = new Map<string, AccountBalance>();

    // Initialize accounts with classification
    for (const a of accounts) {
      const entry = { id: a.id, name: a.name, balance: 0 };
      
      if (a.type === 'ACTIVO') {
        if (isCurrentAsset(a.name)) {
          activosCorrientesMap.set(a.id, entry);
        } else {
          activosNoCorrientesMap.set(a.id, entry);
        }
      }
      if (a.type === 'PASIVO') {
        if (isCurrentLiability(a.name)) {
          pasivosCorrientesMap.set(a.id, entry);
        } else {
          pasivosNoCorrientesMap.set(a.id, entry);
        }
      }
      if (a.type === 'PATRIMONIO') {
        patrimonioMap.set(a.id, entry);
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
        const map = isCurrentAsset(a.name) ? activosCorrientesMap : activosNoCorrientesMap;
        const acc = map.get(a.id);
        if (acc) acc.balance = bal;
      }
      if (a.type === 'PASIVO') {
        const map = isCurrentLiability(a.name) ? pasivosCorrientesMap : pasivosNoCorrientesMap;
        const acc = map.get(a.id);
        if (acc) acc.balance = bal;
      }
      if (a.type === 'PATRIMONIO') {
        const acc = patrimonioMap.get(a.id);
        if (acc) acc.balance = bal;
      }
    }

    // Accumulated profit (income - expenses) until bsDate
    let ingresos = 0, gastos = 0;
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

    // Filter and sort
    const filterAndSort = (map: Map<string, AccountBalance>) =>
      Array.from(map.values())
        .filter(x => x.balance !== 0)
        .sort((a, b) => a.id.localeCompare(b.id));

    const activosCorrientes = filterAndSort(activosCorrientesMap);
    const activosNoCorrientes = filterAndSort(activosNoCorrientesMap);
    const pasivosCorrientes = filterAndSort(pasivosCorrientesMap);
    const pasivosNoCorrientes = filterAndSort(pasivosNoCorrientesMap);
    const patrimonioDetalle = filterAndSort(patrimonioMap);

    // Totals
    const totalActivosCorrientes = activosCorrientes.reduce((sum, x) => sum + x.balance, 0);
    const totalActivosNoCorrientes = activosNoCorrientes.reduce((sum, x) => sum + x.balance, 0);
    const totalActivo = totalActivosCorrientes + totalActivosNoCorrientes;

    const totalPasivosCorrientes = pasivosCorrientes.reduce((sum, x) => sum + x.balance, 0);
    const totalPasivosNoCorrientes = pasivosNoCorrientes.reduce((sum, x) => sum + x.balance, 0);
    const totalPasivo = totalPasivosCorrientes + totalPasivosNoCorrientes;

    const totalPatrimonioContable = patrimonioDetalle.reduce((sum, x) => sum + x.balance, 0);
    const totalPatrimonio = totalPatrimonioContable + utilidadAcumulada;

    // Financial Ratios
    const razonCorriente = totalPasivosCorrientes > 0 
      ? totalActivosCorrientes / totalPasivosCorrientes 
      : null;
    const razonEndeudamiento = totalActivo > 0 
      ? (totalPasivo / totalActivo) * 100 
      : 0;
    const capitalTrabajo = totalActivosCorrientes - totalPasivosCorrientes;

    return {
      activosCorrientes,
      totalActivosCorrientes,
      activosNoCorrientes,
      totalActivosNoCorrientes,
      totalActivo,
      pasivosCorrientes,
      totalPasivosCorrientes,
      pasivosNoCorrientes,
      totalPasivosNoCorrientes,
      totalPasivo,
      patrimonioDetalle,
      utilidadAcumulada,
      totalPatrimonio,
      check: +(totalActivo - (totalPasivo + totalPatrimonio)).toFixed(2),
      razonCorriente,
      razonEndeudamiento,
      capitalTrabajo,
    };
  }, [accounts, entries, bsDate]);

  const handleExportPDF = () => {
    const pdfData: BalanceSheetNIIFData = {
      activosCorrientes: balanceSheet.activosCorrientes,
      totalActivosCorrientes: balanceSheet.totalActivosCorrientes,
      activosNoCorrientes: balanceSheet.activosNoCorrientes,
      totalActivosNoCorrientes: balanceSheet.totalActivosNoCorrientes,
      totalActivo: balanceSheet.totalActivo,
      pasivosCorrientes: balanceSheet.pasivosCorrientes,
      totalPasivosCorrientes: balanceSheet.totalPasivosCorrientes,
      pasivosNoCorrientes: balanceSheet.pasivosNoCorrientes,
      totalPasivosNoCorrientes: balanceSheet.totalPasivosNoCorrientes,
      totalPasivo: balanceSheet.totalPasivo,
      patrimonioDetalle: balanceSheet.patrimonioDetalle,
      utilidadAcumulada: balanceSheet.utilidadAcumulada,
      totalPatrimonio: balanceSheet.totalPatrimonio,
      razonCorriente: balanceSheet.razonCorriente,
      razonEndeudamiento: balanceSheet.razonEndeudamiento,
      capitalTrabajo: balanceSheet.capitalTrabajo,
    };
    exportBalanceSheetNIIFToPDF(pdfData, bsDate);
  };

  const renderAccountSection = (
    title: string,
    accounts: AccountBalance[],
    total: number,
    colorClass: string,
    bgClass: string,
    showSubtotal: boolean = true
  ) => (
    <>
      <TableRow className={bgClass}>
        <TableCell colSpan={3} className={`font-semibold ${colorClass}`}>
          {title}
        </TableCell>
      </TableRow>
      {accounts.map(acc => (
        <TableRow key={acc.id}>
          <TableCell className="font-mono text-xs">{acc.id}</TableCell>
          <TableCell className="text-sm">{acc.name}</TableCell>
          <TableCell className="text-right text-sm">{fmt(acc.balance)}</TableCell>
        </TableRow>
      ))}
      {showSubtotal && accounts.length > 0 && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={2} className="text-right font-medium text-sm">
            Subtotal
          </TableCell>
          <TableCell className="text-right font-medium text-sm">{fmt(total)}</TableCell>
        </TableRow>
      )}
    </>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Balance General (NIIF)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Estado de Situación Financiera</p>
        </div>
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
                {/* Current Assets */}
                {renderAccountSection(
                  'ACTIVOS CORRIENTES',
                  balanceSheet.activosCorrientes,
                  balanceSheet.totalActivosCorrientes,
                  'text-blue-700 dark:text-blue-400',
                  'bg-blue-50 dark:bg-blue-950/30'
                )}
                
                {/* Non-Current Assets */}
                {renderAccountSection(
                  'ACTIVOS NO CORRIENTES',
                  balanceSheet.activosNoCorrientes,
                  balanceSheet.totalActivosNoCorrientes,
                  'text-indigo-700 dark:text-indigo-400',
                  'bg-indigo-50 dark:bg-indigo-950/30'
                )}
                
                {/* Total Assets */}
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
                {/* Current Liabilities */}
                {renderAccountSection(
                  'PASIVOS CORRIENTES',
                  balanceSheet.pasivosCorrientes,
                  balanceSheet.totalPasivosCorrientes,
                  'text-orange-700 dark:text-orange-400',
                  'bg-orange-50 dark:bg-orange-950/30'
                )}
                
                {/* Non-Current Liabilities */}
                {renderAccountSection(
                  'PASIVOS NO CORRIENTES',
                  balanceSheet.pasivosNoCorrientes,
                  balanceSheet.totalPasivosNoCorrientes,
                  'text-amber-700 dark:text-amber-400',
                  'bg-amber-50 dark:bg-amber-950/30'
                )}
                
                {/* Total Liabilities */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="text-right font-semibold">
                    Total Pasivos
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(balanceSheet.totalPasivo)}</TableCell>
                </TableRow>

                {/* EQUITY */}
                <TableRow className="bg-purple-50 dark:bg-purple-950/30">
                  <TableCell colSpan={3} className="font-semibold text-purple-700 dark:text-purple-400">
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
                  <TableCell className="font-medium text-sm">Resultado del Ejercicio</TableCell>
                  <TableCell className={`text-right font-medium text-sm ${balanceSheet.utilidadAcumulada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

        {/* Verification */}
        <div
          className={'text-sm font-medium ' + (balanceSheet.check === 0 ? 'text-green-600' : 'text-red-600')}
        >
          Ecuación contable: Activos - (Pasivo + Patrimonio) ={' '}
          <span className="font-semibold">{fmt(balanceSheet.check)}</span>
          {balanceSheet.check === 0 ? ' ✓ Cuadra' : ' ✗ No cuadra'}
        </div>

        {/* Financial Ratios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Razón Corriente</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${
                balanceSheet.razonCorriente !== null && balanceSheet.razonCorriente >= 1 
                  ? 'text-green-600' 
                  : 'text-amber-600'
              }`}>
                {balanceSheet.razonCorriente !== null 
                  ? `${balanceSheet.razonCorriente.toFixed(2)}x` 
                  : 'N/A'}
                {balanceSheet.razonCorriente !== null && balanceSheet.razonCorriente >= 1 
                  ? <TrendingUp className="h-5 w-5" />
                  : balanceSheet.razonCorriente !== null && <TrendingDown className="h-5 w-5" />}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Activo Corriente / Pasivo Corriente
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Razón de Endeudamiento</div>
              <div className={`text-2xl font-bold ${
                balanceSheet.razonEndeudamiento <= 50 ? 'text-green-600' : 'text-amber-600'
              }`}>
                {balanceSheet.razonEndeudamiento.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pasivo Total / Activo Total
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Capital de Trabajo</div>
              <div className={`text-2xl font-bold ${
                balanceSheet.capitalTrabajo >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {fmt(balanceSheet.capitalTrabajo)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Activo Corriente - Pasivo Corriente
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
