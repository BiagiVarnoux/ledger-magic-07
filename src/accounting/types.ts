// src/accounting/types.ts
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

export interface JournalLine { 
  account_id: string; 
  debit: number; 
  credit: number; 
  line_memo?: string; 
}

export interface JournalEntry { 
  id: string; 
  date: string; 
  memo?: string; 
  lines: JournalLine[]; 
  void_of?: string; 
}

export interface AuxiliaryLedgerEntry {
  id: string;
  client_name: string;
  account_id: string;  // A.5 o P.1
  total_balance: number;  // calculated from movements
}

export interface AuxiliaryMovementDetail {
  id: string;
  aux_entry_id: string; // ID del cliente en auxiliary_ledger
  journal_entry_id: string; // ID del asiento de diario
  movement_date: string;
  amount: number;
  movement_type: 'INCREASE' | 'DECREASE'; // Aumento o Disminución
}

// Seeds (ES)
export const seedAccounts: Account[] = [
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