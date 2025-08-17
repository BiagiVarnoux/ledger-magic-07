import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccounting } from '@/accounting/AccountingProvider';
import { todayISO, fmt } from '@/accounting/utils';
import { TrialRow, IncomeStatement, BalanceSheet } from '@/accounting/types';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { adapter } = useAccounting();
  const [trialPeriod, setTrialPeriod] = useState<string>(todayISO().slice(0, 7)); // yyyy-mm
  const [isFrom, setIsFrom] = useState<string>(todayISO().slice(0, 8) + "01");
  const [isTo, setIsTo] = useState<string>(todayISO());
  const [bsDate, setBsDate] = useState<string>(todayISO());

  const [trialRows, setTrialRows] = useState<{ rows: TrialRow[], totals: { debit: number, credit: number } } | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    adapter.loadTrialBalance(trialPeriod)
      .then(rows => {
        const totals = rows.reduce((t, r) => ({ debit: t.debit + Number(r.debit), credit: t.credit + Number(r.credit) }), { debit: 0, credit: 0 });
        setTrialRows({ rows, totals });
      })
      .catch(e => toast.error(e.message || "Error cargando balance de comprobación"))
      .finally(() => setIsLoading(false));
  }, [adapter, trialPeriod]);

  useEffect(() => {
    setIsLoading(true);
    adapter.loadIncomeStatement(isFrom, isTo)
      .then(data => setIncomeStatement(data))
      .catch(e => toast.error(e.message || "Error cargando estado de resultados"))
      .finally(() => setIsLoading(false));
  }, [adapter, isFrom, isTo]);

  useEffect(() => {
    setIsLoading(true);
    adapter.loadBalanceSheet(bsDate)
      .then(data => setBalanceSheet(data))
      .catch(e => toast.error(e.message || "Error cargando balance general"))
      .finally(() => setIsLoading(false));
  }, [adapter, bsDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      {isLoading && <p>Cargando reportes...</p>}
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
                  {trialRows?.rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.id}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.debit) ? fmt(Number(r.debit)) : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.credit) ? fmt(Number(r.credit)) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(Number(r.balance))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-medium">
                      Totales
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(trialRows?.totals.debit || 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(trialRows?.totals.credit || 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt((trialRows?.totals.debit || 0) - (trialRows?.totals.credit || 0))}
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
                <span className="font-medium">{fmt(Number(incomeStatement?.ingresos) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Gastos</span>
                <span className="font-medium">{fmt(Number(incomeStatement?.gastos) || 0)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span>Utilidad neta</span>
                <span className="font-semibold">{fmt(Number(incomeStatement?.utilidad) || 0)}</span>
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
                <div className="text-xl font-semibold">{fmt(balanceSheet?.activo || 0)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <div className="text-muted-foreground">Pasivos</div>
                <div className="text-xl font-semibold">{fmt(balanceSheet?.pasivo || 0)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-muted">
                <div className="text-muted-foreground">Patrimonio</div>
                <div className="text-xl font-semibold">{fmt(balanceSheet?.patrimonio || 0)}</div>
              </div>
            </div>
            {balanceSheet && (
              <div className={"text-sm " + (balanceSheet.check === 0 ? "text-green-600" : "text-red-600")}>
                Chequeo contable (Activos - (Pasivo+Patrimonio)) = <span className="font-semibold">{fmt(balanceSheet.check)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}