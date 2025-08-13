// src/pages/ledger/Index.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { useAccounting } from '@/accounting/AccountingProvider';
import { todayISO, cmpDate, signedBalanceFor, fmt } from '@/accounting/utils';

export default function LedgerPage() {
  const { accounts, entries } = useAccounting();
  const [ledgerAccount, setLedgerAccount] = useState<string>("A.1");
  const [ledgerFrom, setLedgerFrom] = useState<string>(todayISO().slice(0, 8) + "01");
  const [ledgerTo, setLedgerTo] = useState<string>(todayISO());

  const ledgerData = useMemo(() => {
    const acc = accounts.find(a => a.id === ledgerAccount);
    if (!acc) return { rows: [], opening: 0, closing: 0 } as any;
    
    const before = entries.filter(e => e.date < ledgerFrom);
    const inRange = entries.filter(e => e.date >= ledgerFrom && e.date <= ledgerTo)
      .flatMap(e => e.lines.map(l => ({ e, l })))
      .filter(x => x.l.account_id === ledgerAccount)
      .sort((a, b) => cmpDate(a.e.date, b.e.date));

    const openBal = before.reduce((bal, e) => { 
      for (const l of e.lines) { 
        if (l.account_id !== ledgerAccount) continue; 
        bal += signedBalanceFor(l.debit, l.credit, acc.normal_side); 
      } 
      return bal; 
    }, 0);
    
    let running = openBal;
    const rows = inRange.map(({ e, l }) => { 
      const delta = signedBalanceFor(l.debit, l.credit, acc.normal_side); 
      running += delta; 
      return { 
        date: e.date, 
        id: e.id, 
        memo: e.memo || "", 
        debit: l.debit, 
        credit: l.credit, 
        balance: running 
      }; 
    });
    
    return { rows, opening: openBal, closing: running };
  }, [accounts, entries, ledgerAccount, ledgerFrom, ledgerTo]);

  function exportLedger() {
    const rows = [
      ["Cuenta", "Desde", "Hasta"],
      [ledgerAccount, ledgerFrom, ledgerTo],
      ["Fecha", "Asiento", "Glosa", "Debe", "Haber", "Saldo"]
    ];
    rows.push(["", "", "", "", "", ""]);
    rows.push(["Saldo Inicial", "", "", "", "", String(ledgerData.opening)]);
    for (const r of ledgerData.rows) { 
      rows.push([
        r.date, 
        r.id, 
        r.memo, 
        String(r.debit), 
        String(r.credit), 
        String(r.balance)
      ]); 
    }
    rows.push(["", "", "", "", "", ""]);
    rows.push(["Saldo Final", "", "", "", "", String(ledgerData.closing)]);
    
    const csv = rows.map(r => r.map(x => `"${(x ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = "libro_mayor.csv"; 
    a.click(); 
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro Mayor</h1>
        <Button variant="outline" onClick={exportLedger}>
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
              <Label>Desde</Label>
              <Input 
                type="date" 
                value={ledgerFrom} 
                onChange={e => setLedgerFrom(e.target.value)} 
              />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input 
                type="date" 
                value={ledgerTo} 
                onChange={e => setLedgerTo(e.target.value)} 
              />
            </div>
            <div className="col-span-2 text-right">
              <div className="text-sm text-muted-foreground">
                Saldo inicial: <span className="font-semibold">{fmt(ledgerData.opening)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Saldo final: <span className="font-semibold">{fmt(ledgerData.closing)}</span>
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
                    {fmt(ledgerData.opening)}
                  </TableCell>
                </TableRow>
                {ledgerData.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell>{r.memo}</TableCell>
                    <TableCell className="text-right">
                      {r.debit ? fmt(r.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.credit ? fmt(r.credit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(r.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}