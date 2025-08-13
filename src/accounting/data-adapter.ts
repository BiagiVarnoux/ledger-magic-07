// src/accounting/data-adapter.ts
import { Account, JournalEntry, seedAccounts } from './types';
import { cmpDate } from './utils';

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

export interface IDataAdapter {
  loadAccounts(): Promise<Account[]>;
  upsertAccount(a: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  loadEntries(): Promise<JournalEntry[]>;
  saveEntry(e: JournalEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}

const LS_ACCOUNTS = "acc_es_v1";
const LS_ENTRIES  = "je_es_v1";

export const LocalAdapter: IDataAdapter = {
  async loadAccounts(){ 
    const raw = localStorage.getItem(LS_ACCOUNTS); 
    return raw ? JSON.parse(raw) : seedAccounts; 
  },
  async upsertAccount(a){ 
    const list = await this.loadAccounts(); 
    const i = list.findIndex(x=>x.id===a.id); 
    if (i>=0) list[i]=a; else list.push(a); 
    list.sort((x,y)=>x.id.localeCompare(y.id)); 
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list)); 
  },
  async deleteAccount(id){ 
    const es = await this.loadEntries(); 
    if (es.some(e=> e.lines.some(l=>l.account_id===id))) throw new Error("Cuenta con movimientos"); 
    const list = await this.loadAccounts(); 
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list.filter(a=>a.id!==id))); 
  },
  async loadEntries(){ 
    const raw = localStorage.getItem(LS_ENTRIES); 
    return raw ? JSON.parse(raw) : []; 
  },
  async saveEntry(e){ 
    const list = await this.loadEntries(); 
    list.push(e); 
    list.sort((a,b)=> cmpDate(a.date,b.date) || a.id.localeCompare(b.id)); 
    localStorage.setItem(LS_ENTRIES, JSON.stringify(list)); 
  },
  async deleteEntry(id){ 
    const list = await this.loadEntries(); 
    localStorage.setItem(LS_ENTRIES, JSON.stringify(list.filter(e=>e.id!==id))); 
  },
};

export const SupaAdapter: IDataAdapter = {
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
export async function pickAdapter(): Promise<IDataAdapter> {
  const supa = await getSupabase();
  if (!supa) return LocalAdapter;
  try {
    const { error } = await supa.from("accounts").select("id").limit(1);
    if (error) return LocalAdapter;
    return SupaAdapter;
  } catch { return LocalAdapter; }
}