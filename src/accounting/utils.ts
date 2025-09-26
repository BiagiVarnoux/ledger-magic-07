// src/accounting/utils.ts
import { AccountType, Side, Account, JournalEntry } from './types';
import { getQuarterIdentifier } from './quarterly-utils';

export function fmt(n: number) { 
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

export function todayISO() { 
  return new Date().toISOString().slice(0,10); 
}

export function yyyymm(date: string) { 
  return date.slice(0,7); 
}

export function toDecimal(val?: string) {
  if (!val) return 0;
  // Permite "1.234,56" o "1234,56" (coma como decimal)
  const s = val.replace(/\s+/g, "");
  // Si hay coma, se asume decimal: quita puntos de miles y cambia coma por punto
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

export function formatDecimal(n: number): string {
  // Formatea número para input usando coma como decimal
  return n === 0 ? "" : n.toString().replace(".", ",");
}

export function cmpDate(a: string, b: string) { 
  return a.localeCompare(b); 
}

export function generateEntryId(date: string, existing: JournalEntry[]) {
  const quarterIdentifier = getQuarterIdentifier(date);
  
  // Filter existing entries for the same quarter
  const quarterEntries = existing.filter(e => {
    // Check if the entry ID ends with the same quarter identifier
    return e.id.endsWith(`-${quarterIdentifier}`);
  });
  
  // Find the highest sequential number for this quarter
  let maxSequence = 0;
  quarterEntries.forEach(entry => {
    // Extract sequence number from ID format: XXX-QX-YY
    const match = entry.id.match(/^(\d{3})-/);
    if (match) {
      const sequence = parseInt(match[1], 10);
      if (sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  });
  
  // Generate next sequential number with 3-digit padding
  const nextSequence = maxSequence + 1;
  return `${String(nextSequence).padStart(3, '0')}-${quarterIdentifier}`;
}

export function signedBalanceFor(deb: number, hab: number, side: Side) {
  return side === "DEBE" ? (deb - hab) : (hab - deb);
}

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