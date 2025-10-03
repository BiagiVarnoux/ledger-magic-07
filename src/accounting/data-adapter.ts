// src/accounting/data-adapter.ts
import { Account, JournalEntry, AuxiliaryLedgerEntry, AuxiliaryLedgerDefinition, AuxiliaryMovementDetail, seedAccounts } from './types';
import { cmpDate } from './utils';
import { supabase } from '@/integrations/supabase/client';

type MaybeSupa = import("@supabase/supabase-js").SupabaseClient | null;

async function getSupabase(): Promise<MaybeSupa> {
  return supabase;
}

export interface IDataAdapter {
  loadAccounts(): Promise<Account[]>;
  upsertAccount(a: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  loadEntries(): Promise<JournalEntry[]>;
  saveEntry(e: JournalEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  loadAuxiliaryDefinitions(): Promise<AuxiliaryLedgerDefinition[]>;
  upsertAuxiliaryDefinition(d: AuxiliaryLedgerDefinition): Promise<void>;
  deleteAuxiliaryDefinition(id: string): Promise<void>;
  loadAuxiliaryEntries(): Promise<AuxiliaryLedgerEntry[]>;
  upsertAuxiliaryEntry(a: AuxiliaryLedgerEntry): Promise<AuxiliaryLedgerEntry>;
  deleteAuxiliaryEntry(id: string): Promise<void>;
  loadAuxiliaryDetails(auxEntryId: string): Promise<AuxiliaryMovementDetail[]>;
  upsertAuxiliaryMovementDetails(details: AuxiliaryMovementDetail[]): Promise<void>;
  loadClosingBalances(quarterEndDate: string): Promise<Record<string, number>>;
  saveClosingBalances(quarterEndDate: string, balances: Record<string, number>): Promise<void>;
}

const LS_ACCOUNTS = "acc_es_v1";
const LS_ENTRIES  = "je_es_v1";
const LS_AUX_DEFINITIONS = "aux_definitions_v1";
const LS_AUXILIARY = "aux_ledger_v1";
const LS_AUX_MOVEMENTS = "aux_movements_v1";

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
  async loadAuxiliaryDefinitions(){ 
    const raw = localStorage.getItem(LS_AUX_DEFINITIONS); 
    return raw ? JSON.parse(raw) : []; 
  },
  async upsertAuxiliaryDefinition(d){ 
    const list = await this.loadAuxiliaryDefinitions(); 
    const i = list.findIndex(x=>x.id===d.id); 
    if (i>=0) list[i]=d; else list.push(d); 
    list.sort((x,y)=>x.name.localeCompare(y.name)); 
    localStorage.setItem(LS_AUX_DEFINITIONS, JSON.stringify(list)); 
  },
  async deleteAuxiliaryDefinition(id){ 
    const list = await this.loadAuxiliaryDefinitions(); 
    localStorage.setItem(LS_AUX_DEFINITIONS, JSON.stringify(list.filter(d=>d.id!==id))); 
  },
  async loadAuxiliaryEntries(){
    const raw = localStorage.getItem(LS_AUXILIARY); 
    const entries = raw ? JSON.parse(raw) : [];
    
    // Calculate total_balance from movements for each entry
    const movementsRaw = localStorage.getItem(LS_AUX_MOVEMENTS);
    const allMovements: AuxiliaryMovementDetail[] = movementsRaw ? JSON.parse(movementsRaw) : [];
    
    return entries.map((entry: AuxiliaryLedgerEntry) => {
      const entryMovements = allMovements.filter(m => m.aux_entry_id === entry.id);
      const total_balance = entryMovements.reduce((sum, m) => {
        return sum + (m.movement_type === 'INCREASE' ? m.amount : -m.amount);
      }, 0);
      return { ...entry, total_balance };
    });
  },
  async upsertAuxiliaryEntry(a){ 
    const list = await this.loadAuxiliaryEntries(); 
    const { total_balance, ...entryData } = a; // Remove calculated field
    
    // Generate UUID if creating new entry
    if (!entryData.id || entryData.id.includes('-')) {
      entryData.id = crypto.randomUUID();
    }
    
    const i = list.findIndex(x=>x.id===entryData.id); 
    if (i>=0) list[i]={...list[i], ...entryData}; else list.push(entryData); 
    list.sort((x,y)=>x.client_name.localeCompare(y.client_name)); 
    localStorage.setItem(LS_AUXILIARY, JSON.stringify(list)); 
    
    // Return the saved entry with calculated total_balance
    return list.find(x => x.id === entryData.id)!;
  },
  async deleteAuxiliaryEntry(id){ 
    const list = await this.loadAuxiliaryEntries(); 
    localStorage.setItem(LS_AUXILIARY, JSON.stringify(list.filter(a=>a.id!==id))); 
  },
  async loadAuxiliaryDetails(auxEntryId: string): Promise<AuxiliaryMovementDetail[]> {
    const raw = localStorage.getItem(LS_AUX_MOVEMENTS);
    const allMovements: AuxiliaryMovementDetail[] = raw ? JSON.parse(raw) : [];
    return allMovements
      .filter(m => m.aux_entry_id === auxEntryId)
      .sort((a, b) => b.movement_date.localeCompare(a.movement_date));
  },
  async upsertAuxiliaryMovementDetails(details: AuxiliaryMovementDetail[]): Promise<void> {
    const raw = localStorage.getItem(LS_AUX_MOVEMENTS);
    const allMovements: AuxiliaryMovementDetail[] = raw ? JSON.parse(raw) : [];
    
    for (const detail of details) {
      // Generate UUID if creating new movement
      if (!detail.id || detail.id.includes('-')) {
        detail.id = crypto.randomUUID();
      }
      
      const i = allMovements.findIndex(m => m.id === detail.id);
      if (i >= 0) allMovements[i] = detail;
      else allMovements.push(detail);
    }
    
    localStorage.setItem(LS_AUX_MOVEMENTS, JSON.stringify(allMovements));
  },
  async loadClosingBalances(quarterEndDate: string): Promise<Record<string, number>> {
    const raw = localStorage.getItem(`closures_${quarterEndDate}`);
    if (raw) return JSON.parse(raw);
    
    // Calculate balances if no closure exists
    const entries = await this.loadEntries();
    const accounts = await this.loadAccounts();
    const balances: Record<string, number> = {};
    
    // Filter entries up to quarter end date
    const relevantEntries = entries.filter(e => e.date <= quarterEndDate);
    
    for (const account of accounts) {
      let debit = 0;
      let credit = 0;
      
      for (const entry of relevantEntries) {
        for (const line of entry.lines) {
          if (line.account_id === account.id) {
            debit += line.debit;
            credit += line.credit;
          }
        }
      }
      
      // Calculate signed balance based on account normal side
      const balance = account.normal_side === "DEBE" ? (debit - credit) : (credit - debit);
      if (balance !== 0) {
        balances[account.id] = balance;
      }
    }
    
    return balances;
  },
  async saveClosingBalances(quarterEndDate: string, balances: Record<string, number>): Promise<void> {
    localStorage.setItem(`closures_${quarterEndDate}`, JSON.stringify(balances));
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
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    const accountWithUser = { ...a, user_id: user.id };
    const { error } = await supa.from("accounts").upsert(accountWithUser);
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
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    const { error: e1 } = await supa.from("journal_entries").upsert({ id: e.id, date: e.date, memo: e.memo||null, void_of: e.void_of||null, user_id: user.id });
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
  async loadAuxiliaryDefinitions(){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadAuxiliaryDefinitions();
    const { data, error } = await supa.from("auxiliary_ledger_definitions").select("id,name,account_id").order("name");
    if (error) throw error; return (data||[]) as AuxiliaryLedgerDefinition[];
  },
  async upsertAuxiliaryDefinition(d){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.upsertAuxiliaryDefinition(d);
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    const defWithUser = { ...d, user_id: user.id };
    const { error } = await supa.from("auxiliary_ledger_definitions").upsert(defWithUser);
    if (error) throw error;
  },
  async deleteAuxiliaryDefinition(id){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.deleteAuxiliaryDefinition(id);
    const { error } = await supa.from("auxiliary_ledger_definitions").delete().eq("id", id);
    if (error) throw error;
  },
  async loadAuxiliaryEntries(){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadAuxiliaryEntries();
    const { data, error } = await supa.from("auxiliary_ledger").select("id,client_name,account_id,definition_id").order("client_name");
    if (error) throw error;
    
    // Calculate total_balance from movements for each entry
    const entries = data || [];
    const result: AuxiliaryLedgerEntry[] = [];
    
    for (const entry of entries) {
      const movements = await this.loadAuxiliaryDetails(entry.id);
      const total_balance = movements.reduce((sum, m) => {
        return sum + (m.movement_type === 'INCREASE' ? m.amount : -m.amount);
      }, 0);
      result.push({ ...entry, total_balance });
    }
    
    return result;
  },
  async upsertAuxiliaryEntry(a){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.upsertAuxiliaryEntry(a);
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    
    // Extract only the fields needed for database (exclude calculated total_balance)
    const auxData = {
      id: a.id,
      client_name: a.client_name,
      account_id: a.account_id,
      definition_id: a.definition_id
    };
    
    // For new entries, generate UUID explicitly since DB doesn't have default
    const isNew = !auxData.id || auxData.id.includes('-');
    if (isNew) {
      auxData.id = crypto.randomUUID();
    }
    
    const auxWithUser = { ...auxData, user_id: user.id };
    
    let savedEntry;
    if (isNew) {
      // INSERT: include the generated id
      const { data, error } = await supa
        .from("auxiliary_ledger")
        .insert(auxWithUser)
        .select("id,client_name,account_id,definition_id")
        .single();
      if (error) throw error;
      savedEntry = data;
    } else {
      // UPDATE: use .update().select().single()
      const { data, error } = await supa
        .from("auxiliary_ledger")
        .update(auxWithUser)
        .eq("id", auxData.id)
        .select("id,client_name,account_id,definition_id")
        .single();
      if (error) throw error;
      savedEntry = data;
    }
    
    // Calculate total_balance from movements
    const movements = await this.loadAuxiliaryDetails(savedEntry.id);
    const calculatedBalance = movements.reduce((sum, m) => {
      return sum + (m.movement_type === 'INCREASE' ? m.amount : -m.amount);
    }, 0);
    
    return { ...savedEntry, total_balance: calculatedBalance } as AuxiliaryLedgerEntry;
  },
  async deleteAuxiliaryEntry(id){
    const supa = await getSupabase(); if (!supa) return LocalAdapter.deleteAuxiliaryEntry(id);
    const { error } = await supa.from("auxiliary_ledger").delete().eq("id", id);
    if (error) throw error;
  },
  async loadAuxiliaryDetails(auxEntryId: string): Promise<AuxiliaryMovementDetail[]> {
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadAuxiliaryDetails(auxEntryId);
    const { data, error } = await supa
      .from("auxiliary_movement_details")
      .select("id,aux_entry_id,journal_entry_id,movement_date,amount,movement_type")
      .eq("aux_entry_id", auxEntryId)
      .order("movement_date", { ascending: false });
    if (error) throw error;
    return (data || []) as AuxiliaryMovementDetail[];
  },
  async upsertAuxiliaryMovementDetails(details: AuxiliaryMovementDetail[]): Promise<void> {
    const supa = await getSupabase(); if (!supa) return LocalAdapter.upsertAuxiliaryMovementDetails(details);
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    
    const payload = details.map(d => {
      const detailCopy = { ...d, user_id: user.id };
      // For new movements, let the database generate the UUID
      if (!detailCopy.id || detailCopy.id.includes('-')) {
        delete detailCopy.id;
      }
      return detailCopy;
    });
    
    const { error } = await supa.from("auxiliary_movement_details").insert(payload);
    if (error) throw error;
  },
  async loadClosingBalances(quarterEndDate: string): Promise<Record<string, number>> {
    const supa = await getSupabase(); if (!supa) return LocalAdapter.loadClosingBalances(quarterEndDate);
    
    const { data, error } = await supa
      .from("quarterly_closures")
      .select("balances")
      .eq("closure_date", quarterEndDate)
      .maybeSingle();
    
    if (error) throw error;
    if (data) return data.balances as Record<string, number>;
    
    // If no closure exists, calculate from entries
    const entries = await this.loadEntries();
    const accounts = await this.loadAccounts();
    const balances: Record<string, number> = {};
    
    // Filter entries up to quarter end date
    const relevantEntries = entries.filter(e => e.date <= quarterEndDate);
    
    for (const account of accounts) {
      let debit = 0;
      let credit = 0;
      
      for (const entry of relevantEntries) {
        for (const line of entry.lines) {
          if (line.account_id === account.id) {
            debit += line.debit;
            credit += line.credit;
          }
        }
      }
      
      // Calculate signed balance based on account normal side
      const balance = account.normal_side === "DEBE" ? (debit - credit) : (credit - debit);
      if (balance !== 0) {
        balances[account.id] = balance;
      }
    }
    
    return balances;
  },
  async saveClosingBalances(quarterEndDate: string, balances: Record<string, number>): Promise<void> {
    const supa = await getSupabase(); if (!supa) return LocalAdapter.saveClosingBalances(quarterEndDate, balances);
    
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");
    
    const { error } = await supa.from("quarterly_closures").upsert({
      user_id: user.id,
      closure_date: quarterEndDate,
      balances
    });
    
    if (error) throw error;
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