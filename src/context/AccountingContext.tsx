import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

// ------------------------ Supabase lazy (no instanciar al cargar) ------------------------
type MaybeSupa = import("@supabase/supabase-js").SupabaseClient | null;

const readEnv = () => ({
  url:
    (typeof window !== "undefined" && (window as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    "",
  key:
    (typeof window !== "undefined" && (window as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    "",
});

let supabasePromise: Promise<MaybeSupa> | null = null;
async function getSupabase(): Promise<MaybeSupa> {
  const { url, key } = readEnv();
  if (!url || !key) return null;
  if (!supabasePromise) {
    supabasePromise = (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(url, key, { auth: { persistSession: false } });
    })();
  }
  return supabasePromise;
}

// ------------------------ Tipos (ES) ------------------------
export const ACCOUNT_TYPES = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"] as const;
export const SIDES = ["DEBE", "HABER"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];
export type Side = typeof SIDES[number];

export interface Account {
  id: string;         // ej. "A.1"
  name: string;
  type: AccountType;  // ACTIVO | PASIVO | PATRIMONIO | INGRESO | GASTO
  normal_side: Side;  // DEBE | HABER
  is_active: boolean;
}
export interface JournalLine { account_id: string; debit: number; credit: number; line_memo?: string; }
export interface JournalEntry { id: string; date: string; memo?: string; lines: JournalLine[]; void_of?: string; }

// --- Abreviaciones de tipo de cuenta y lógica de signo (+/-) ---
export const TYPE_ABBR: Record<AccountType, string> = {
  ACTIVO: "A",
  PASIVO: "P",
  PATRIMONIO: "Pn",
  INGRESO: "I",
  GASTO: "G",
};

export function increaseSideFor(type: AccountType): Side {
  // A y G aumentan en DEBE; P, Pn e I aumentan en HABER
  return (type === "ACTIVO" || type === "GASTO") ? "DEBE" : "HABER";
}

export function signForLine(account: Account | undefined, line: { debit?: number | string; credit?: number | string }): "+" | "-" | "" {
  if (!account) return "";
  const debitVal = typeof line.debit === "string" ? toDecimal(line.debit) : (line.debit || 0);
  const creditVal = typeof line.credit === "string" ? toDecimal(line.credit) : (line.credit || 0);
  const side: Side = debitVal > 0 ? "DEBE" : creditVal > 0 ? "HABER" : "" as any;
  if (!side) return "";
  return side === increaseSideFor(account.type) ? "+" : "-";
}

// ------------------------ Seeds (ES) ------------------------
const seedAccounts: Account[] = [
  { id: "A.1",  name: "Banco MN",            type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.2",  name: "Caja MN",             type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.3",  name: "Banco ME",            type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.4",  name: "Inventario",          type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.5",  name: "Cuentas por Cobrar",  type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.6",  name: "Crédito Fiscal IVA",  type: "ACTIVO",      normal_side: "DEBE",  is_active: true },
  { id: "A.7",  name: "USDT",                type: "ACTIVO",      normal_side: "DEBE",  is_active: true },

  { id: "G.1",  name: "Gastos Generales",    type: "GASTO",       normal_side: "DEBE",  is_active: true },
  { id: "G.2",  name: "Flete Aéreo",         type: "GASTO",       normal_side: "DEBE",  is_active: true },
  { id: "G.3",  name: "IT",                  type: "GASTO",       normal_side: "DEBE",  is_active: true },
  { id: "G.4",  name: "Costo de Ventas",     type: "GASTO",       normal_side: "DEBE",  is_active: true },

  { id: "I.1",  name: "Ventas",              type: "INGRESO",     normal_side: "HABER", is_active: true },

  { id: "P.1",  name: "Cuentas por Pagar",   type: "PASIVO",      normal_side: "HABER", is_active: true },
  { id: "P.2",  name: "IT por Pagar",        type: "PASIVO",      normal_side: "HABER", is_active: true },
  { id: "P.3",  name: "Débito Fiscal IVA",   type: "PASIVO",      normal_side: "HABER", is_active: true },

  { id: "Pn.1", name: "Capital",             type: "PATRIMONIO",  normal_side: "HABER", is_active: true },
];

export function fmt(n: number) { return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function todayISO() { return new Date().toISOString().slice(0,10); }
export function yyyymm(date: string) { return date.slice(0,7); }
export function toDecimal(val?: string) {
  if (!val) return 0;
  // Permite "1.234,56" o "1,234.56" y espacios
  const s = val.replace(/\s+/g, "");
  // Si hay coma, se asume decimal: quita puntos de miles y cambia coma por punto
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
export function cmpDate(a:string,b:string){ return a.localeCompare(b); }
export function generateEntryId(date: string, existing: JournalEntry[]) {
  const prefix = date.slice(0,7); // yyyy-mm
  const count = existing.filter(e => e.date.slice(0,7) === prefix).length + 1;
  return `${prefix}-${String(count).padStart(5,'0')}`;
}
export function signedBalanceFor(deb: number, hab: number, side: Side) {
  return side === "DEBE" ? (deb - hab) : (hab - deb);
}

// ------------------------ Adaptadores de datos ------------------------
interface IDataAdapter {
  loadAccounts(): Promise<Account[]>;
  upsertAccount(a: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  loadEntries(): Promise<JournalEntry[]>;
  saveEntry(e: JournalEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}

const LS_ACCOUNTS = "acc_es_v1";
const LS_ENTRIES  = "je_es_v1";

const LocalAdapter: IDataAdapter = {
  async loadAccounts(){ const raw = localStorage.getItem(LS_ACCOUNTS); return raw? JSON.parse(raw): seedAccounts; },
  async upsertAccount(a){ const list = await this.loadAccounts(); const i = list.findIndex(x=>x.id===a.id); if (i>=0) list[i]=a;
 else list.push(a); list.sort((x,y)=>x.id.localeCompare(y.id)); localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list)); },
  async deleteAccount(id){ const es = await this.loadEntries(); if (es.some(e=> e.lines.some(l=>l.account_id===id))) throw new Error("Cuenta con movimientos"); const list = await this.loadAccounts(); localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list.filter(a=>a.id!==id))); },
  async loadEntries(){ const raw = localStorage.getItem(LS_ENTRIES); return raw? JSON.parse(raw): []; },
  async saveEntry(e){ const list = await this.loadEntries(); list.push(e); list.sort((a,b)=> cmpDate(a.date,b.date) || a.id.localeCompare(b.id)); localStorage.setItem(LS_ENTRIES, JSON.stringify(list)); },
  async deleteEntry(id){ const list = await this.loadEntries(); localStorage.setItem(LS_ENTRIES, JSON.stringify(list.filter(e=>e.id!==id))); },
};

const SupaAdapter: IDataAdapter = {
  async loadAccounts(){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadAccounts();
    const { data, error } = await supa.from("accounts").select("id,name,type,normal_side,is_active").order("id");
    if (error) throw error; return (data||[]) as Account[];
  },
  async upsertAccount(a){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.upsertAccount(a);
    const { error } = await supa.from("accounts").upsert(a);
    if (error) throw error;
  },
  async deleteAccount(id){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.deleteAccount(id);
    const { error } = await supa.from("accounts").delete().eq("id", id);
    if (error) throw error;
  },
  async loadEntries(){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadEntries();
    const { data: heads, error: e1 } = await supa.from("journal_entries").select("id,date,memo,void_of").order("date");
    if (e1) throw e1; const ids = (heads||[]).map(h=>h.id); if (ids.length===0) return [];
    const { data: lines, error: e2 } = await supa.from("journal_lines").select("entry_id,account_id,debit,credit,line_memo").in("entry_id", ids);
    if (e2) throw e2;
    const map = new Map<string, JournalEntry>();
    for (const h of (heads||[])) map.set(h.id, { id: h.id, date: String(h.date), memo: (h as any).memo || undefined, void_of: (h as any).void_of || undefined, lines: [] });
    for (const l of (lines||[])) { const e = map.get((l as any).entry_id)!; e.lines.push({ account_id: (l as any).account_id, debit: Number((l as any).debit)||0, credit: Number((l as any).credit)||0, line_memo: (l as any).line_memo||undefined }); }
    return Array.from(map.values()).sort((a,b)=> cmpDate(a.date,b.date) || a.id.localeCompare(b.id));
  },
  async saveEntry(e){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.saveEntry(e);
    const { error: e1 } = await supa.from("journal_entries").upsert({ id: e.id, date: e.date, memo: e.memo||null, void_of: e.void_of||null });
    if (e1) throw e1;
    const { error: eDel } = await supa.from("journal_lines").delete().eq("entry_id", e.id);
    if (eDel) throw eDel;
    const payload = e.lines.map(l=> ({ entry_id: e.id, account_id: l.account_id, debit: l.debit, credit: l.credit, line_memo: l.line_memo||null }));
    const { error: e2 } = await supa.from("journal_lines").insert(payload);
    if (e2) throw e2;
  },
  async deleteEntry(id){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.deleteEntry(id);
    const { error: e1 } = await supa.from("journal_lines").delete().eq("entry_id", id);
    if (e1) throw e1;
    const { error: e2 } = await supa.from("journal_entries").delete().eq("id", id);
    if (e2) throw e2;
  },
};

// Elegir adapter dinámicamente
async function pickAdapter(): Promise<IDataAdapter> {
  const supa = await getSupabase();
  if (!supa) return LocalAdapter;
  try {
    const { error } = await supa.from("accounts").select("id").limit(1);
    if (error) return LocalAdapter;
    return SupaAdapter;
  } catch { return LocalAdapter; }
}

// ------------------------ Contexto ------------------------
export type LineDraft = { account_id?: string; debit?: string; credit?: string; line_memo?: string };

interface AccountingContextValue {
  accounts: Account[];
  entries: JournalEntry[];
  adapter: IDataAdapter;
  loadAccounts: () => Promise<void>;
  loadEntries: () => Promise<void>;
  upsertAccount: (a: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  canDeleteAccount: (id: string) => boolean;
  saveEntry: (date: string, memo: string, lines: LineDraft[]) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  voidEntry: (orig: JournalEntry) => Promise<void>;
}

const AccountingContext = createContext<AccountingContextValue | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [adapter, setAdapter] = useState<IDataAdapter>(LocalAdapter);

  useEffect(() => { (async () => {
    const db = await pickAdapter(); setAdapter(db);
    try {
      const acc = await db.loadAccounts(); setAccounts(acc);
      const es  = await db.loadEntries();  setEntries(es);
    } catch(e:any){ console.error(e); toast.error(e.message||"Error cargando datos"); }
  })(); }, []);

  async function loadAccounts(){ setAccounts(await adapter.loadAccounts()); }
  async function loadEntries(){ setEntries(await adapter.loadEntries()); }

  async function upsertAccount(a: Account){
    if (!a.id || !a.name || !a.type || !a.normal_side) { toast.error("Completa código, nombre, tipo y lado"); return; }
    if (!ACCOUNT_TYPES.includes(a.type)) { toast.error("Tipo inválido"); return; }
    if (!SIDES.includes(a.normal_side)) { toast.error("Lado inválido"); return; }
    try {
      await adapter.upsertAccount(a);
      await loadAccounts();
      toast.success("Cuenta guardada");
    } catch(e:any){ toast.error(e.message||"Error guardando cuenta"); }
  }

  async function deleteAccount(id: string){ try { await adapter.deleteAccount(id); await loadAccounts(); toast.success("Cuenta eliminada"); } catch(e:any){ toast.error(e.message||"No se pudo eliminar"); } }

  function canDeleteAccount(id: string){ return !entries.some(e => e.lines.some(l => l.account_id === id)); }

  function validateAndBuildEntry(date: string, memo: string, lines: LineDraft[]): JournalEntry | null {
    const clean: JournalLine[] = [];
    for (const l of lines){
      const acc = l.account_id?.trim(); const d = toDecimal(l.debit); const c = toDecimal(l.credit);
      if (!acc && d===0 && c===0) continue;
      if (!acc) { toast.error("Línea sin cuenta"); return null; }
      const accExists = accounts.find(a => a.id === acc && a.is_active);
      if (!accExists) { toast.error(`Cuenta ${acc} no existe o está inactiva`); return null; }
      if (d>0 && c>0){ toast.error("Una línea no puede tener Debe y Haber a la vez"); return null; }
      if (d===0 && c===0){ toast.error("Línea sin importe"); return null; }
      clean.push({ account_id: acc, debit: d, credit: c, line_memo: l.line_memo?.trim() });
    }
    if (clean.length < 2){ toast.error("El asiento necesita al menos 2 líneas"); return null; }
    const sumD = clean.reduce((s,l)=>s+l.debit,0); const sumC = clean.reduce((s,l)=>s+l.credit,0);
    if (+sumD.toFixed(2) !== +sumC.toFixed(2)) { toast.error("El asiento no cuadra (Debe ≠ Haber)"); return null; }
    const id = generateEntryId(date, entries);
    return { id, date, memo: memo.trim() || undefined, lines: clean };
  }

  async function saveEntry(date: string, memo: string, lines: LineDraft[]){
    const je = validateAndBuildEntry(date, memo, lines); if (!je) return;
    try { await adapter.saveEntry(je); await loadEntries(); toast.success(`Asiento ${je.id} guardado`); }
    catch(e:any){ toast.error(e.message||"Error guardando asiento"); }
  }

  async function deleteEntry(id: string){ try { await adapter.deleteEntry(id); await loadEntries(); toast.success("Asiento eliminado"); } catch(e:any){ toast.error(e.message||"No se pudo eliminar asiento"); } }

  async function voidEntry(orig: JournalEntry){
    const inv: JournalEntry = { id: generateEntryId(orig.date, entries), date: orig.date, memo: (orig.memo ? `${orig.memo} `: "") + "(ANULACIÓN)", void_of: orig.id, lines: orig.lines.map(l=>({ account_id: l.account_id, debit: l.credit, credit: l.debit, line_memo: l.line_memo })) };
    try { await adapter.saveEntry(inv); await loadEntries(); toast.success(`Asiento ${orig.id} anulado con ${inv.id}`); } catch(e:any){ toast.error(e.message||"No se pudo anular"); }
  }

  const value: AccountingContextValue = { accounts, entries, adapter, loadAccounts, loadEntries, upsertAccount, deleteAccount, canDeleteAccount, saveEntry, deleteEntry, voidEntry };
  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
};

export function useAccounting(){
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error("useAccounting must be used within AccountingProvider");
  return ctx;
}

export default AccountingContext;
