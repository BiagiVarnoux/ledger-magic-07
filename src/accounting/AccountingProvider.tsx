// src/accounting/AccountingProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, JournalEntry } from './types';
import { IDataAdapter, LocalAdapter, pickAdapter } from './data-adapter';
import { toast } from 'sonner';

interface AccountingContextType {
  accounts: Account[];
  entries: JournalEntry[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
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
      setAccounts,
      setEntries,
      adapter
    }}>
      {children}
    </AccountingContext.Provider>
  );
}