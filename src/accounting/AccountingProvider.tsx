// src/accounting/AccountingProvider.tsx
// Context provider for accounting data (accounts, entries, auxiliary ledgers, fiscal years)
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, FiscalYear, JournalEntry, AuxiliaryLedgerEntry, AuxiliaryLedgerDefinition, KardexDefinition } from './types';
import { IDataAdapter, LocalAdapter, pickAdapter } from './data-adapter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AccountingContextType {
  accounts: Account[];
  entries: JournalEntry[];
  auxiliaryEntries: AuxiliaryLedgerEntry[];
  auxiliaryDefinitions: AuxiliaryLedgerDefinition[];
  kardexDefinitions: KardexDefinition[];
  fiscalYears: FiscalYear[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  setAuxiliaryEntries: React.Dispatch<React.SetStateAction<AuxiliaryLedgerEntry[]>>;
  setAuxiliaryDefinitions: React.Dispatch<React.SetStateAction<AuxiliaryLedgerDefinition[]>>;
  setKardexDefinitions: React.Dispatch<React.SetStateAction<KardexDefinition[]>>;
  setFiscalYears: React.Dispatch<React.SetStateAction<FiscalYear[]>>;
  adapter: IDataAdapter;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export function useAccounting() {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
}

interface AccountingProviderProps {
  children: React.ReactNode;
}

export function AccountingProvider({ children }: AccountingProviderProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [auxiliaryEntries, setAuxiliaryEntries] = useState<AuxiliaryLedgerEntry[]>([]);
  const [auxiliaryDefinitions, setAuxiliaryDefinitions] = useState<AuxiliaryLedgerDefinition[]>([]);
  const [kardexDefinitions, setKardexDefinitions] = useState<KardexDefinition[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [adapter, setAdapter] = useState<IDataAdapter>(LocalAdapter);

  useEffect(() => {
    (async () => {
      const db = await pickAdapter();
      setAdapter(db);
      try {
        const acc = await db.loadAccounts();
        setAccounts(acc);
        const es = await db.loadEntries();
        setEntries(es);
        const aux = await db.loadAuxiliaryEntries();
        setAuxiliaryEntries(aux);
        const defs = await db.loadAuxiliaryDefinitions();
        setAuxiliaryDefinitions(defs);
        const kardexDefs = await db.loadKardexDefinitions();
        setKardexDefinitions(kardexDefs);

        // Load fiscal years directly from Supabase (no LocalAdapter fallback needed;
        // when empty the system treats all periods as OPEN — see fiscal-year-utils.ts)
        if (supabase) {
          const { data: fyData, error: fyError } = await supabase
            .from('fiscal_years')
            .select('*')
            .order('year', { ascending: true });
          if (fyError) {
            // Table may not exist yet in local dev — silently skip
            console.warn('fiscal_years not loaded:', fyError.message);
          } else {
            setFiscalYears((fyData ?? []) as FiscalYear[]);
          }
        }
      } catch(e: any) {
        console.error(e);
        toast.error(e.message || "Error cargando datos");
      }
    })();
  }, []);

  return (
    <AccountingContext.Provider value={{
      accounts,
      entries,
      auxiliaryEntries,
      auxiliaryDefinitions,
      kardexDefinitions,
      fiscalYears,
      setAccounts,
      setEntries,
      setAuxiliaryEntries,
      setAuxiliaryDefinitions,
      setKardexDefinitions,
      setFiscalYears,
      adapter
    }}>
      {children}
    </AccountingContext.Provider>
  );
}
