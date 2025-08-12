import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Undo2, Pencil, Trash2, Save, Plus, Download } from "lucide-react";
import { toast } from "sonner";

// SEO helpers
const PAGE_TITLE = "App Contable — Plan de Cuentas, Diario y Reportes";
const PAGE_DESC = "Contabilidad simple: plan de cuentas, diario, mayor y reportes. Exportación CSV.";

// ------------------------ Tipos y constantes ------------------------
const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
const SIDES = ["DEBIT", "CREDIT"] as const;

type AccountType = typeof ACCOUNT_TYPES[number];
type Side = typeof SIDES[number];

interface Account {
  id: string; // código (ej. "1.1.1")
  name: string;
  type: AccountType;
  normal_side: Side;
  is_active: boolean;
}

interface JournalLine { account_id: string; debit: number; credit: number; line_memo?: string; }
interface JournalEntry { id: string; date: string; memo?: string; lines: JournalLine[]; void_of?: string; }

// ------------------------ Seeds y utilidades ------------------------
const seedAccounts: Account[] = [
  { id: "1.1.1", name: "Banco MN", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.2", name: "Banco ME", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.3", name: "Caja MN", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.4", name: "Inventario", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.5", name: "Crédito Fiscal IVA", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.6", name: "Cuentas por Cobrar", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "1.1.7", name: "USDT", type: "ASSET", normal_side: "DEBIT", is_active: true },
  { id: "2.1.1", name: "Cuentas por Pagar", type: "LIABILITY", normal_side: "CREDIT", is_active: true },
  { id: "2.1.2", name: "IT por Pagar", type: "LIABILITY", normal_side: "CREDIT", is_active: true },
  { id: "2.1.3", name: "Débito Fiscal IVA", type: "LIABILITY", normal_side: "CREDIT", is_active: true },
  { id: "3.1.1", name: "Capital", type: "EQUITY", normal_side: "CREDIT", is_active: true },
  { id: "4.1.1", name: "Ventas", type: "INCOME", normal_side: "CREDIT", is_active: true },
  { id: "5.1.1", name: "Gastos Generales", type: "EXPENSE", normal_side: "DEBIT", is_active: true },
  { id: "5.1.2", name: "Flete Aéreo", type: "EXPENSE", normal_side: "DEBIT", is_active: true },
  { id: "5.1.3", name: "IT", type: "EXPENSE", normal_side: "DEBIT", is_active: true },
  { id: "5.1.4", name: "Costo de Ventas", type: "EXPENSE", normal_side: "DEBIT", is_active: true },
];

function fmt(n: number) { return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function yyyymm(date: string) { return date.slice(0, 7); }
function cmpDate(a: string, b: string) { return a.localeCompare(b); }
function generateEntryId(date: string, existing: JournalEntry[]) {
  const prefix = date.slice(0, 7);
  const count = existing.filter(e => e.date.slice(0, 7) === prefix).length + 1;
  return `${prefix}-${String(count).padStart(5, '0')}`;
}
function signedBalanceFor(d: number, c: number, side: Side) { return side === "DEBIT" ? (d - c) : (c - d); }

// ------------------------ Adaptadores de datos ------------------------
interface IDataAdapter {
  loadAccounts(): Promise<Account[]>;
  upsertAccount(a: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  loadEntries(): Promise<JournalEntry[]>;
  saveEntry(e: JournalEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}

// LocalStorage adapter
const LS_ACCOUNTS = "acc_v1"; const LS_ENTRIES = "je_v2"; // v2 incluye lines embebidas
const LocalAdapter: IDataAdapter = {
  async loadAccounts() { const raw = localStorage.getItem(LS_ACCOUNTS); return raw ? JSON.parse(raw) : seedAccounts; },
  async upsertAccount(a) { const list: Account[] = await this.loadAccounts(); const idx = list.findIndex(x => x.id === a.id); if (idx >= 0) list[idx] = a; else list.push(a); list.sort((x, y) => x.id.localeCompare(y.id)); localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list)); },
  async deleteAccount(id) { const es: JournalEntry[] = await this.loadEntries(); if (es.some(e => e.lines.some(l => l.account_id === id))) throw new Error("Cuenta con movimientos"); const list: Account[] = await this.loadAccounts(); const out = list.filter(a => a.id !== id); localStorage.setItem(LS_ACCOUNTS, JSON.stringify(out)); },
  async loadEntries() { const raw = localStorage.getItem(LS_ENTRIES); return raw ? JSON.parse(raw) : []; },
  async saveEntry(e) { const list = await this.loadEntries(); list.push(e); list.sort((a, b) => cmpDate(a.date, b.date) || a.id.localeCompare(b.id)); localStorage.setItem(LS_ENTRIES, JSON.stringify(list)); },
  async deleteEntry(id) { const list = await this.loadEntries(); localStorage.setItem(LS_ENTRIES, JSON.stringify(list.filter(e => e.id !== id))); },
};

export default function Index() {
  // SEO for this page
  useEffect(() => {
    document.title = PAGE_TITLE;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", PAGE_DESC);
  }, []);

  const DB: IDataAdapter = LocalAdapter;

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // Cargar de LocalStorage (seed si vacío)
  useEffect(() => { (async () => { try {
    const acc = await DB.loadAccounts(); setAccounts(acc);
    const es = await DB.loadEntries(); setEntries(es);
  } catch (e: any) { console.error(e); toast.error(e.message || "Error cargando datos"); } })(); }, []);

  // ------- Plan de Cuentas -------
  const [accDraft, setAccDraft] = useState<Partial<Account>>({ type: "ASSET", normal_side: "DEBIT", is_active: true });
  const [editingAccId, setEditingAccId] = useState<string | null>(null);

  async function upsertAccount() {
    const d = accDraft as Account;
    if (!d.id || !d.name || !d.type || !d.normal_side) { toast.error("Completa código, nombre, tipo y lado normal"); return; }
    try {
      await DB.upsertAccount(d);
      const list = await DB.loadAccounts(); setAccounts(list);
      toast.success(editingAccId ? "Cuenta actualizada" : "Cuenta creada");
      setAccDraft({ type: "ASSET", normal_side: "DEBIT", is_active: true }); setEditingAccId(null);
    } catch (e: any) { toast.error(e.message || "Error guardando cuenta"); }
  }
  function editAccount(a: Account) { setAccDraft(a); setEditingAccId(a.id); }
  async function toggleAccountActive(a: Account) {
    try { await DB.upsertAccount({ ...a, is_active: !a.is_active }); setAccounts(await DB.loadAccounts()); }
    catch (e: any) { toast.error(e.message || "No se pudo actualizar estado"); }
  }
  async function deleteAccount(id: string) { try { await DB.deleteAccount(id); setAccounts(await DB.loadAccounts()); toast.success("Cuenta eliminada"); } catch (e: any) { toast.error(e.message || "No se pudo eliminar"); } }
  function canDeleteAccount(id: string) { return !entries.some(e => e.lines.some(l => l.account_id === id)); }

  // ------- Libro Diario -------
  type LineDraft = { account_id?: string; debit?: string; credit?: string; line_memo?: string };
  const [date, setDate] = useState<string>(todayISO());
  const [memo, setMemo] = useState<string>("");
  const [lines, setLines] = useState<LineDraft[]>([{}, {}, {}]);

  function addLine() { setLines(ls => [...ls, {}]); }
  function setLine(idx: number, patch: Partial<LineDraft>) { setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l)); }
  function removeLine(idx: number) { setLines(ls => ls.filter((_, i) => i !== idx)); }

  const totals = useMemo(() => { let d = 0, c = 0; for (const l of lines) { const dv = parseFloat(l.debit || "0"); const cv = parseFloat(l.credit || "0"); if (!isNaN(dv)) d += dv; if (!isNaN(cv)) c += cv; } return { debit: d, credit: c, diff: +(d - c).toFixed(2) }; }, [lines]);

  function validateAndBuildEntry(): JournalEntry | null {
    const cleanLines: JournalLine[] = [];
    for (const l of lines) {
      const acc = l.account_id?.trim(); const d = +(l.debit || "0"); const c = +(l.credit || "0");
      if (!acc && d === 0 && c === 0) continue; // skip vacío
      if (!acc) { toast.error("Línea sin cuenta"); return null; }
      const accExists = accounts.find(a => a.id === acc && a.is_active);
      if (!accExists) { toast.error(`Cuenta ${acc} no existe o está inactiva`); return null; }
      if (d > 0 && c > 0) { toast.error("Una línea no puede tener Debe y Haber a la vez"); return null; }
      if (d === 0 && c === 0) { toast.error("Línea sin importe"); return null; }
      cleanLines.push({ account_id: acc, debit: d, credit: c, line_memo: l.line_memo?.trim() });
    }
    if (cleanLines.length < 2) { toast.error("El asiento necesita al menos 2 líneas"); return null; }
    const sumD = cleanLines.reduce((s, l) => s + l.debit, 0); const sumC = cleanLines.reduce((s, l) => s + l.credit, 0);
    if (+sumD.toFixed(2) !== +sumC.toFixed(2)) { toast.error("El asiento no cuadra (Debe ≠ Haber)"); return null; }
    const id = generateEntryId(date, entries);
    return { id, date, memo: memo.trim() || undefined, lines: cleanLines };
  }

  async function saveEntry() {
    const je = validateAndBuildEntry(); if (!je) return;
    try { await DB.saveEntry(je); const list = await DB.loadEntries(); setEntries(list); toast.success(`Asiento ${je.id} guardado`); setMemo(""); setLines([{}, {}, {}]); }
    catch (e: any) { toast.error(e.message || "Error guardando asiento"); }
  }

  async function deleteEntry(id: string) { try { await DB.deleteEntry(id); setEntries(await DB.loadEntries()); toast.success("Asiento eliminado"); } catch (e: any) { toast.error(e.message || "No se pudo eliminar asiento"); } }
  async function voidEntry(orig: JournalEntry) {
    const inv: JournalEntry = { id: generateEntryId(orig.date, entries), date: orig.date, memo: (orig.memo ? `${orig.memo} ` : "") + "(ANULACIÓN)", void_of: orig.id, lines: orig.lines.map(l => ({ account_id: l.account_id, debit: l.credit, credit: l.debit, line_memo: l.line_memo })) };
    try { await DB.saveEntry(inv); setEntries(await DB.loadEntries()); toast.success(`Asiento ${orig.id} anulado con ${inv.id}`); } catch (e: any) { toast.error(e.message || "No se pudo anular"); }
  }

  // ------- Libro Mayor -------
  const [ledgerAccount, setLedgerAccount] = useState<string>("1.1.1");
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

    const openBal = before.reduce((bal, e) => { for (const l of e.lines) { if (l.account_id !== ledgerAccount) continue; bal += signedBalanceFor(l.debit, l.credit, acc.normal_side); } return bal; }, 0);
    let running = openBal;
    const rows = inRange.map(({ e, l }) => { const delta = signedBalanceFor(l.debit, l.credit, acc.normal_side); running += delta; return { date: e.date, id: e.id, memo: e.memo || "", debit: l.debit, credit: l.credit, balance: running }; });
    return { rows, opening: openBal, closing: running };
  }, [accounts, entries, ledgerAccount, ledgerFrom, ledgerTo]);

  // ------- Reportes -------
  const [trialPeriod, setTrialPeriod] = useState<string>(todayISO().slice(0, 7));
  const trialRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: AccountType; side: Side; debit: number; credit: number }>();
    for (const a of accounts) { map.set(a.id, { id: a.id, name: a.name, type: a.type, side: a.normal_side, debit: 0, credit: 0 }); }
    for (const e of entries) { if (yyyymm(e.date) !== trialPeriod) continue; for (const l of e.lines) { const r = map.get(l.account_id); if (!r) continue; r.debit += l.debit; r.credit += l.credit; } }
    const rows = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
    const totals = rows.reduce((t, r) => { t.debit += r.debit; t.credit += r.credit; return t; }, { debit: 0, credit: 0 });
    return { rows, totals };
  }, [accounts, entries, trialPeriod]);

  const [isFrom, setIsFrom] = useState<string>(todayISO().slice(0, 8) + "01");
  const [isTo, setIsTo] = useState<string>(todayISO());
  const incomeStatement = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) { if (e.date < isFrom || e.date > isTo) continue; for (const l of e.lines) { const a = accounts.find(x => x.id === l.account_id); if (!a) continue; if (a.type === 'INCOME') { income += (l.credit - l.debit); } if (a.type === 'EXPENSE') { expense += (l.debit - l.credit); } } }
    return { income, expense, net: income - expense };
  }, [accounts, entries, isFrom, isTo]);

  const [bsDate, setBsDate] = useState<string>(todayISO());
  const balanceSheet = useMemo(() => {
    const sums = { asset: 0, liability: 0, equity: 0 } as any;
    for (const a of accounts) { let bal = 0; for (const e of entries) { if (e.date > bsDate) continue; for (const l of e.lines) { if (l.account_id !== a.id) continue; bal += signedBalanceFor(l.debit, l.credit, a.normal_side); } } if (a.type === 'ASSET') sums.asset += bal; if (a.type === 'LIABILITY') sums.liability += bal; if (a.type === 'EQUITY') sums.equity += bal; }
    return { ...sums, check: +(sums.asset - (sums.liability + sums.equity)).toFixed(2) };
  }, [accounts, entries, bsDate]);

  // ------- Exportar CSV -------
  function exportCSV(filename: string, rows: string[][]) {
    const csv = rows.map(r => r.map(x => `"${(x ?? "").toString().replace(/\"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function exportJournal() { const rows = [["ID", "Fecha", "Glosa", "Cuenta", "Debe", "Haber", "Glosa línea"]]; for (const e of entries) { for (const l of e.lines) { rows.push([e.id, e.date, e.memo || "", l.account_id, String(l.debit), String(l.credit), l.line_memo || ""]); } } exportCSV("libro_diario.csv", rows); }
  function exportLedger() { const rows = [["Cuenta", "Desde", "Hasta"], [ledgerAccount, ledgerFrom, ledgerTo], ["Fecha", "Asiento", "Glosa", "Debe", "Haber", "Saldo"]]; rows.push(["", "", "", "", "", ""]); rows.push(["Saldo Inicial", "", "", "", "", String(ledgerData.opening)]); for (const r of ledgerData.rows) { rows.push([r.date, r.id, r.memo, String(r.debit), String(r.credit), String(r.balance)]); } rows.push(["", "", "", "", "", ""]); rows.push(["Saldo Final", "", "", "", "", String(ledgerData.closing)]); exportCSV("libro_mayor.csv", rows); }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "App Contable",
          applicationCategory: "BusinessApplication",
          description: PAGE_DESC,
          operatingSystem: "Web",
        }) }}
      />

      <main className="min-h-screen p-6 space-y-6 container mx-auto">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">App Contable — <span className="text-muted-foreground">LocalStorage</span></h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportJournal}><Download className="w-4 h-4 mr-2" />Exportar Diario</Button>
            <Button variant="outline" onClick={exportLedger}><Download className="w-4 h-4 mr-2" />Exportar Mayor</Button>
          </div>
        </header>

        <section>
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="accounts">Plan de Cuentas</TabsTrigger>
              <TabsTrigger value="journal">Libro Diario</TabsTrigger>
              <TabsTrigger value="ledger">Libro Mayor</TabsTrigger>
              <TabsTrigger value="reports">Reportes</TabsTrigger>
            </TabsList>

            {/* PLAN DE CUENTAS */}
            <TabsContent value="accounts">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Plan de Cuentas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-1">
                      <Label>Código</Label>
                      <Input value={accDraft.id || ""} onChange={e => setAccDraft(p => ({ ...p, id: e.target.value }))} placeholder="1.1.1" />
                    </div>
                    <div className="col-span-2">
                      <Label>Nombre</Label>
                      <Input value={accDraft.name || ""} onChange={e => setAccDraft(p => ({ ...p, name: e.target.value }))} placeholder="Caja MN" />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={accDraft.type as string} onValueChange={(v) => setAccDraft(p => ({ ...p, type: v as AccountType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Lado normal</Label>
                      <Select value={accDraft.normal_side as string} onValueChange={(v) => setAccDraft(p => ({ ...p, normal_side: v as Side }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Label className="mr-2">Activa</Label>
                        <input type="checkbox" checked={!!accDraft.is_active} onChange={e => setAccDraft(p => ({ ...p, is_active: e.target.checked }))} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={upsertAccount}><Save className="w-4 h-4 mr-2" />{editingAccId ? "Guardar cambios" : "Agregar cuenta"}</Button>
                    {editingAccId && (<Button variant="outline" onClick={() => { setAccDraft({ type: "ASSET", normal_side: "DEBIT", is_active: true }); setEditingAccId(null); }}>Cancelar</Button>)}
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Lado</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono">{a.id}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{a.type}</TableCell>
                            <TableCell>{a.normal_side}</TableCell>
                            <TableCell>{a.is_active ? "Activa" : "Inactiva"}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => editAccount(a)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => toggleAccountActive(a)}>{a.is_active ? "Desactivar" : "Activar"}</Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteAccount(a.id)} disabled={!canDeleteAccount(a.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LIBRO DIARIO */}
            <TabsContent value="journal">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Libro Diario – Nuevo Asiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-6 gap-3">
                    <div>
                      <Label>Fecha</Label>
                      <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="col-span-5">
                      <Label>Glosa</Label>
                      <Input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Descripción del asiento" />
                    </div>
                  </div>

                  <div className="border rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Cuenta</TableHead>
                          <TableHead>Debe</TableHead>
                          <TableHead>Haber</TableHead>
                          <TableHead>Glosa línea</TableHead>
                          <TableHead className="text-right"><Button size="sm" variant="outline" onClick={addLine}><Plus className="w-4 h-4" /></Button></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Select value={l.account_id} onValueChange={(v) => setLine(idx, { account_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                                <SelectContent className="max-h-80">
                                  {accounts.filter(a => a.is_active).map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.id} – {a.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="0.01" value={l.debit || ""} onChange={e => setLine(idx, { debit: e.target.value, credit: "" })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="0.01" value={l.credit || ""} onChange={e => setLine(idx, { credit: e.target.value, debit: "" })} />
                            </TableCell>
                            <TableCell>
                              <Input value={l.line_memo || ""} onChange={e => setLine(idx, { line_memo: e.target.value })} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => removeLine(idx)} title="Eliminar fila"><Trash2 className="w-4 h-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="text-right font-medium">Totales</TableCell>
                          <TableCell className="font-semibold">{fmt(totals.debit)}</TableCell>
                          <TableCell className="font-semibold">{fmt(totals.credit)}</TableCell>
                          <TableCell colSpan={2} className={`text-right font-semibold ${totals.diff === 0 ? 'text-success' : 'text-destructive'}`}>{totals.diff === 0 ? "Cuadra" : `Diferencia: ${fmt(totals.diff)}`}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveEntry}><Save className="w-4 h-4 mr-2" />Guardar asiento</Button>
                    <Button variant="outline" onClick={() => { setMemo(""); setLines([{}, {}, {}]); }}>Limpiar</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6">
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Asientos registrados</CardTitle></CardHeader>
                  <CardContent>
                    <div className="border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Glosa</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.sort((a, b) => cmpDate(b.date, a.date)).map(e => (
                            <TableRow key={e.id}>
                              <TableCell className="font-mono">{e.id}</TableCell>
                              <TableCell>{e.date}</TableCell>
                              <TableCell>{e.memo}</TableCell>
                              <TableCell>
                                <div className="text-sm space-y-1">
                                  {e.lines.map((l, i) => {
                                    const a = accounts.find(x => x.id === l.account_id);
                                    return <div key={i} className="flex gap-2"><span className="font-mono w-24">{l.account_id}</span><span className="flex-1">{a?.name}</span><span className="w-24 text-right">{l.debit ? fmt(l.debit) : ""}</span><span className="w-24 text-right">{l.credit ? fmt(l.credit) : ""}</span></div>;
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={() => voidEntry(e)} title="Anular"><Undo2 className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteEntry(e.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* LIBRO MAYOR */}
            <TabsContent value="ledger">
              <Card className="shadow-sm">
                <CardHeader><CardTitle>Libro Mayor</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-6 gap-3 items-end">
                    <div className="col-span-2">
                      <Label>Cuenta</Label>
                      <Select value={ledgerAccount} onValueChange={setLedgerAccount}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-80">
                          {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.id} – {a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Desde</Label>
                      <Input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label>Hasta</Label>
                      <Input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} />
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-sm text-muted-foreground">Saldo inicial: <span className="font-semibold">{fmt(ledgerData.opening)}</span></div>
                      <div className="text-sm text-muted-foreground">Saldo final: <span className="font-semibold">{fmt(ledgerData.closing)}</span></div>
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
                          <TableCell colSpan={5} className="text-right font-medium">Saldo Inicial</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(ledgerData.opening)}</TableCell>
                        </TableRow>
                        {ledgerData.rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.date}</TableCell>
                            <TableCell className="font-mono">{r.id}</TableCell>
                            <TableCell>{r.memo}</TableCell>
                            <TableCell className="text-right">{r.debit ? fmt(r.debit) : ""}</TableCell>
                            <TableCell className="text-right">{r.credit ? fmt(r.credit) : ""}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(r.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* REPORTES */}
            <TabsContent value="reports">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Balance de comprobación */}
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Balance de comprobación</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div>
                        <Label>Periodo</Label>
                        <Input type="month" value={trialPeriod} onChange={e => setTrialPeriod(e.target.value)} />
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
                          {trialRows.rows.map(r => { const saldo = r.side === 'DEBIT' ? (r.debit - r.credit) : (r.credit - r.debit); return (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono">{r.id}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right">{r.debit ? fmt(r.debit) : ""}</TableCell>
                              <TableCell className="text-right">{r.credit ? fmt(r.credit) : ""}</TableCell>
                              <TableCell className="text-right font-medium">{fmt(saldo)}</TableCell>
                            </TableRow>
                          ); })}
                          <TableRow>
                            <TableCell colSpan={2} className="text-right font-medium">Totales</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(trialRows.totals.debit)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(trialRows.totals.credit)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(trialRows.totals.debit - trialRows.totals.credit)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Estado de Resultados */}
                <Card className="shadow-sm">
                  <CardHeader><CardTitle>Estado de resultados</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Desde</Label>
                        <Input type="date" value={isFrom} onChange={e => setIsFrom(e.target.value)} />
                      </div>
                      <div>
                        <Label>Hasta</Label>
                        <Input type="date" value={isTo} onChange={e => setIsTo(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Ingresos</span><span className="font-medium">{fmt(incomeStatement.income)}</span></div>
                      <div className="flex justify-between"><span>Gastos</span><span className="font-medium">{fmt(incomeStatement.expense)}</span></div>
                      <div className="flex justify-between text-base"><span>Utilidad neta</span><span className="font-semibold">{fmt(incomeStatement.net)}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Balance General */}
                <Card className="shadow-sm lg:col-span-2">
                  <CardHeader><CardTitle>Balance general</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="w-full max-w-xs">
                      <Label>Al</Label>
                      <Input type="date" value={bsDate} onChange={e => setBsDate(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-4 rounded-2xl bg-muted"><div className="text-muted-foreground">Activos</div><div className="text-xl font-semibold">{fmt(balanceSheet.asset)}</div></div>
                      <div className="p-4 rounded-2xl bg-muted"><div className="text-muted-foreground">Pasivos</div><div className="text-xl font-semibold">{fmt(balanceSheet.liability)}</div></div>
                      <div className="p-4 rounded-2xl bg-muted"><div className="text-muted-foreground">Patrimonio</div><div className="text-xl font-semibold">{fmt(balanceSheet.equity)}</div></div>
                    </div>
                    <div className={`text-sm ${balanceSheet.check === 0 ? 'text-success' : 'text-destructive'}`}>Chequeo contable (Activos - (Pasivo+Patrimonio)) = <span className="font-semibold">{fmt(balanceSheet.check)}</span></div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <footer className="text-xs text-muted-foreground pt-2">
          Persistencia local por defecto. Conecta Supabase desde Lovable para habilitar nube y multiusuario.
        </footer>
      </main>
    </>
  );
}
