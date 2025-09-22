// src/accounting/AccountingProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, JournalEntry, AuxiliaryLedgerEntry } from './types';
import { IDataAdapter, LocalAdapter, pickAdapter } from './data-adapter';
import { toast } from 'sonner';

interface AccountingContextType {
  accounts: Account[];
  entries: JournalEntry[];
  auxiliaryEntries: AuxiliaryLedgerEntry[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  setAuxiliaryEntries: React.Dispatch<React.SetStateAction<AuxiliaryLedgerEntry[]>>;
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
      setAccounts,
      setEntries,
      setAuxiliaryEntries,
      adapter
    }}>
      {children}
    </AccountingContext.Provider>
  );
}