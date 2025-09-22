// src/router.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AccountingProvider } from './accounting/AccountingProvider';
import { AppShell } from './components/layout/AppShell';
import AccountsPage from './pages/accounts/Index';
import JournalPage from './pages/journal/Index';
import AuxiliaryLedgersPage from './pages/auxiliary-ledgers/Index';
import LedgerPage from './pages/ledger/Index';
import ReportsPage from './pages/reports/Index';
import NotFound from './pages/NotFound';

export function AppRouter() {
  return (
    <BrowserRouter>
      <AccountingProvider>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/accounts" replace />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="auxiliary-ledgers" element={<AuxiliaryLedgersPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AccountingProvider>
    </BrowserRouter>
  );
}