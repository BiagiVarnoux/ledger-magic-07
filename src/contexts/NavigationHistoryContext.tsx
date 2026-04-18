// src/contexts/NavigationHistoryContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface HistoryEntry {
  path: string;
  timestamp: number;
}

interface NavigationHistoryContextValue {
  history: HistoryEntry[];
  previous: HistoryEntry | null;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextValue>({
  history: [],
  previous: null,
});

const MAX_HISTORY = 5;

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory((prev) => {
      const last = prev[0];
      if (last && last.path === location.pathname) return prev;
      const next = [{ path: location.pathname, timestamp: Date.now() }, ...prev];
      return next.slice(0, MAX_HISTORY);
    });
  }, [location.pathname]);

  const previous = history[1] ?? null;

  return (
    <NavigationHistoryContext.Provider value={{ history, previous }}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  return useContext(NavigationHistoryContext);
}
