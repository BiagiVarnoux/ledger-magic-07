// src/accounting/fiscal-year-utils.ts
// Utilities for fiscal year (gestión) handling.
// Follows the QuickBooks/Xero model: no closing journal entries are generated.
// Separation between fiscal years is done via dynamic date filtering in reports.

import { Account, FiscalYear, JournalEntry } from './types';
import { round2 } from './utils';

export interface FiscalYearBounds {
  year: number;
  start: string;  // YYYY-MM-DD  (e.g. "2026-01-01")
  end: string;    // YYYY-MM-DD  (e.g. "2026-12-31")
}

/** Returns the calendar-year bounds for any ISO date string. */
export function getFiscalYearBounds(date: string): FiscalYearBounds {
  const year = parseInt(date.slice(0, 4), 10);
  return {
    year,
    start: `${year}-01-01`,
    end:   `${year}-12-31`,
  };
}

export interface PeriodResult {
  ingresos: number;
  gastos: number;
  resultado: number;  // ingresos - gastos (positive = profit)
}

/**
 * Computes the net income/loss for all journal entries whose date falls
 * within [startDate, endDate] (both inclusive, ISO string comparison).
 */
export function computePeriodResult(
  accounts: Account[],
  entries: JournalEntry[],
  startDate: string,
  endDate: string,
): PeriodResult {
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  let ingresos = 0;
  let gastos = 0;

  for (const e of entries) {
    if (e.date < startDate || e.date > endDate) continue;
    for (const l of e.lines) {
      const a = accountMap.get(l.account_id);
      if (!a) continue;
      if (a.type === 'INGRESO') ingresos += round2(l.credit - l.debit);
      if (a.type === 'GASTO')   gastos   += round2(l.debit  - l.credit);
    }
  }

  return {
    ingresos: round2(ingresos),
    gastos:   round2(gastos),
    resultado: round2(ingresos - gastos),
  };
}

/**
 * Returns true if the given date falls inside a CLOSED fiscal year.
 * When fiscalYears is empty the function always returns false, so the
 * system remains fully usable before any gestiones are configured.
 */
export function isDateInClosedPeriod(date: string, fiscalYears: FiscalYear[]): boolean {
  return fiscalYears.some(
    fy => fy.status === 'CLOSED' && date >= fy.start_date && date <= fy.end_date,
  );
}

/**
 * Returns the FiscalYear record that contains the given date, or undefined
 * if no record covers it (system treats missing records as OPEN).
 */
export function getFiscalYearForDate(date: string, fiscalYears: FiscalYear[]): FiscalYear | undefined {
  return fiscalYears.find(fy => date >= fy.start_date && date <= fy.end_date);
}

/**
 * Identifies the canonical "Utilidades Acumuladas" account from the chart
 * of accounts. Checks by id='Pn.2' first, then by name keyword.
 */
export function findUtilidadesAcumuladasAccount(accounts: Account[]): Account | undefined {
  return (
    accounts.find(a => a.id === 'Pn.2' && a.type === 'PATRIMONIO') ??
    accounts.find(
      a =>
        a.type === 'PATRIMONIO' &&
        (a.name.toLowerCase().includes('utilidades acumuladas') ||
         a.name.toLowerCase().includes('resultados acumulados')),
    )
  );
}
