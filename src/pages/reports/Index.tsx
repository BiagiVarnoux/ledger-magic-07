// src/pages/reports/Index.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccounting } from '@/accounting/AccountingProvider';
import { todayISO, yyyymm, signedBalanceFor, fmt } from '@/accounting/utils';
import { AccountType, Side } from '@/accounting/types';

export default function ReportsPage() {
  const { accounts, entries } = useAccounting();
  const [trialPeriod, setTrialPeriod] = useState<string>(todayISO().slice(0, 7)); // yyyy-mm
  const [isFrom, setIsFrom] = useState<string>(todayISO().slice(0, 8) + "01");
  const [isTo, setIsTo] = useState<string>(todayISO());
  const [bsDate, setBsDate] = useState<string>(todayISO());

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
      if (yyyymm(e.date) !== trialPeriod) continue; 
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
  }, [accounts, entries, trialPeriod]);

  const incomeStatement = useMemo(() => {
    let ingresos = 0, gastos = 0;
    for (const e of entries) {
      if (e.date < isFrom || e.date > isTo) continue;
      for (const l of e.lines) {
        const a = accounts.find(x => x.id === l.account_id); 
        if (!a) continue;
        if (a.type === 'INGRESO') { 
          ingresos += (l.credit - l.debit); 
        }
        if (a.type === 'GASTO') { 
          gastos += (l.debit - l.credit); 
        }
      }
    }
    return { ingresos, gastos, utilidad: ingresos - gastos };
  }, [accounts, entries, isFrom, isTo]);

  const balanceSheet = useMemo(() => {
  const sums = { activo: 0, pasivo: 0, patrimonio: 0 } as any;

  // Saldos por tipo de cuenta hasta la fecha del balance (bsDate)
  for (const a of accounts) {
    let bal = 0;
    for (const e of entries) { 
      if (e.date > bsDate) continue; 
      for (const l of e.lines) { 
        if (l.account_id !== a.id) continue; 
        bal += signedBalanceFor(l.debit, l.credit, a.normal_side); 
      } 
    }
    if (a.type === 'ACTIVO')      sums.activo      += bal;
    if (a.type === 'PASIVO')      sums.pasivo      += bal;
    if (a.type === 'PATRIMONIO')  sums.patrimonio  += bal;
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
  const utilidad = ingresos - gastos;

  // Patrimonio = patrimonio contable + utilidad acumulada
  sums.patrimonio += utilidad;

  return { 
    ...sums, 
    check: +(sums.activo - (sums.pasivo + sums.patrimonio)).toFixed(2) 
  };
}, [accounts, entries, bsDate]);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Balance de comprobación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <Label>Periodo</Label>
                <Input 
                  type="month" 
                  value={trialPeriod} 
                  onChange={e => setTrialPeriod(e.target.value)} 
                />
              </div>
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
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-medium">
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

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Estado de resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input 
                  type="date" 
                  value={isFrom} 
                  onChange={e => setIsFrom(e.target.value)} 
                />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input 
                  type="date" 
                  value={isTo} 
                  onChange={e => setIsTo(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Ingresos</span>
                <span className="font-medium">{fmt(incomeStatement.ingresos)}</span>
              </div>
              <div className="flex justify-between">
                <span>Gastos</span>
                <span className="font-medium">{fmt(incomeStatement.gastos)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span>Utilidad neta</span>
                <span className="font-semibold">{fmt(incomeStatement.utilidad)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full max-w-xs">
              <Label>Al</Label>
              <Input 
                type="date" 
                value={bsDate} 
                onChange={e => setBsDate(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-muted">
                <div className="text-muted-foreground">Activos</div>
                <div className="text-xl font-semibold">{fmt(balanceSheet.activo)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <div className="text-muted-foreground">Pasivos</div>
                <div className="text-xl font-semibold">{fmt(balanceSheet.pasivo)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <div className="text-muted-foreground">Patrimonio</div>
                <div className="text-xl font-semibold">{fmt(balanceSheet.patrimonio)}</div>
              </div>
            </div>
            <div className={"text-sm " + (balanceSheet.check === 0 ? "text-green-600" : "text-red-600")}>
              Chequeo contable (Activos - (Pasivo+Patrimonio)) = <span className="font-semibold">{fmt(balanceSheet.check)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}