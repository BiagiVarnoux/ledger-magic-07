// src/pages/reports/Index.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccounting } from '@/accounting/AccountingProvider';
import { todayISO, yyyymm, signedBalanceFor, fmt } from '@/accounting/utils';
import { AccountType, Side } from '@/accounting/types';
import { getCurrentQuarter, getAllQuartersFromStart, parseQuarterString, isDateInQuarter } from '@/accounting/quarterly-utils';

export default function ReportsPage() {
  const { accounts, entries, adapter } = useAccounting();
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter().label);
  const [bsDate, setBsDate] = useState<string>(todayISO());
  
  // Available quarters for selection
  const availableQuarters = useMemo(() => getAllQuartersFromStart(2020), []);
  const currentQuarter = useMemo(() => parseQuarterString(selectedQuarter), [selectedQuarter]);

  // Balance de Comprobación para el trimestre seleccionado
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
        credit: 0 
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
    const totals = rows.reduce((t, r) => { 
      t.debit += r.debit; 
      t.credit += r.credit; 
      return t; 
    }, { debit: 0, credit: 0 });
    
    return { rows, totals };
  }, [accounts, entries, currentQuarter]);

  // Estado de Resultados para el trimestre seleccionado (desglosado por cuenta)
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
          if (acc) acc.amount += (l.credit - l.debit);
        }
        if (a.type === 'GASTO') { 
          const acc = gastosMap.get(a.id);
          if (acc) acc.amount += (l.debit - l.credit);
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
      utilidad: ingresos - gastos 
    };
  }, [accounts, entries, currentQuarter]);

  // Balance General desglosado por cuenta hasta bsDate
  const balanceSheet = useMemo(() => {
    const activosMap = new Map<string, { id: string; name: string; balance: number }>();
    const pasivosMap = new Map<string, { id: string; name: string; balance: number }>();
    const patrimonioMap = new Map<string, { id: string; name: string; balance: number }>();
    
    // Inicializar cuentas
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
    
    // Calcular saldos por cuenta hasta la fecha del balance (bsDate)
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
    
    // Utilidad acumulada (ingresos - gastos) hasta bsDate
    let ingresos = 0, gastos = 0;
    for (const e of entries) {
      if (e.date > bsDate) continue;
      for (const l of e.lines) {
        const a = accounts.find(x => x.id === l.account_id);
        if (!a) continue;
        if (a.type === 'INGRESO') { ingresos += (l.credit - l.debit); }
        if (a.type === 'GASTO')   { gastos   += (l.debit  - l.credit); }
      }
    }
    const utilidadAcumulada = ingresos - gastos;
    
    // Filtrar cuentas con saldo diferente de cero
    const activosDetalle = Array.from(activosMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const pasivosDetalle = Array.from(pasivosMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const patrimonioDetalle = Array.from(patrimonioMap.values())
      .filter(x => x.balance !== 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    
    // Totales
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
      check: +(totalActivo - (totalPasivo + totalPatrimonio)).toFixed(2) 
    };
  }, [accounts, entries, bsDate]);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes Financieros</h1>

      <Tabs defaultValue="trial-balance" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="trial-balance">Balance de Comprobación</TabsTrigger>
          <TabsTrigger value="income-statement">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance General</TabsTrigger>
        </TabsList>

        {/* Balance de Comprobación */}
        <TabsContent value="trial-balance" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Balance de Comprobación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
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
              </div>
              <div className="text-sm text-muted-foreground">
                Período: {currentQuarter.startDate} - {currentQuarter.endDate}
              </div>
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
                      const saldo = r.side === 'DEBE' ? (r.debit - r.credit) : (r.credit - r.debit);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.id}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="text-right">
                            {r.debit ? fmt(r.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.credit ? fmt(r.credit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {fmt(saldo)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="text-right font-semibold">
                        Totales
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(trialRows.totals.debit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(trialRows.totals.credit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(trialRows.totals.debit - trialRows.totals.credit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Estado de Resultados */}
        <TabsContent value="income-statement" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Estado de Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
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
              </div>
              <div className="text-sm text-muted-foreground">
                Período: {currentQuarter.startDate} - {currentQuarter.endDate}
              </div>
              
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
                      <TableCell className="text-right font-semibold">
                        {fmt(incomeStatement.ingresos)}
                      </TableCell>
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
                      <TableCell className="text-right font-semibold">
                        {fmt(incomeStatement.gastos)}
                      </TableCell>
                    </TableRow>
                    
                    {/* Utilidad Neta */}
                    <TableRow className="bg-muted">
                      <TableCell colSpan={2} className="text-right font-bold">
                        UTILIDAD NETA
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {fmt(incomeStatement.utilidad)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance General */}
        <TabsContent value="balance-sheet" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Balance General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full max-w-xs">
                <Label>Fecha de corte:</Label>
                <Input 
                  type="date" 
                  value={bsDate} 
                  onChange={e => setBsDate(e.target.value)} 
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Al: {bsDate}
              </div>
              
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
                    {/* ACTIVOS */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="font-semibold">
                        ACTIVOS
                      </TableCell>
                    </TableRow>
                    {balanceSheet.activosDetalle.map(act => (
                      <TableRow key={act.id}>
                        <TableCell className="font-mono">{act.id}</TableCell>
                        <TableCell>{act.name}</TableCell>
                        <TableCell className="text-right">{fmt(act.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="text-right font-semibold">
                        Total Activos
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(balanceSheet.totalActivo)}
                      </TableCell>
                    </TableRow>
                    
                    {/* PASIVOS */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="font-semibold">
                        PASIVOS
                      </TableCell>
                    </TableRow>
                    {balanceSheet.pasivosDetalle.map(pas => (
                      <TableRow key={pas.id}>
                        <TableCell className="font-mono">{pas.id}</TableCell>
                        <TableCell>{pas.name}</TableCell>
                        <TableCell className="text-right">{fmt(pas.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="text-right font-semibold">
                        Total Pasivos
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(balanceSheet.totalPasivo)}
                      </TableCell>
                    </TableRow>
                    
                    {/* PATRIMONIO */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="font-semibold">
                        PATRIMONIO
                      </TableCell>
                    </TableRow>
                    {balanceSheet.patrimonioDetalle.map(pat => (
                      <TableRow key={pat.id}>
                        <TableCell className="font-mono">{pat.id}</TableCell>
                        <TableCell>{pat.name}</TableCell>
                        <TableCell className="text-right">{fmt(pat.balance)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Utilidad Acumulada */}
                    <TableRow>
                      <TableCell className="font-mono">—</TableCell>
                      <TableCell className="font-medium">Utilidad/Pérdida Acumulada</TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(balanceSheet.utilidadAcumulada)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="text-right font-semibold">
                        Total Patrimonio
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(balanceSheet.totalPatrimonio)}
                      </TableCell>
                    </TableRow>
                    
                    {/* Total Pasivo + Patrimonio */}
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
              
              <div className={"text-sm font-medium " + (balanceSheet.check === 0 ? "text-green-600" : "text-red-600")}>
                Chequeo contable: Activos - (Pasivo + Patrimonio) = <span className="font-semibold">{fmt(balanceSheet.check)}</span>
                {balanceSheet.check === 0 ? " ✓ Cuadra" : " ✗ No cuadra"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}