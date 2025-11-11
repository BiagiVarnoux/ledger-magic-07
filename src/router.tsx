// src/router.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AccountingProvider } from './accounting/AccountingProvider';
import { AppShell } from './components/layout/AppShell';

const AccountsPage = React.lazy(() => import('./pages/accounts/Index'));
const JournalPage = React.lazy(() => import('./pages/journal/Index'));
const AuxiliaryLedgersPage = React.lazy(() => import('./pages/auxiliary-ledgers/Index'));
const LedgerPage = React.lazy(() => import('./pages/ledger/Index'));
const ReportsPage = React.lazy(() => import('./pages/reports/Index'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

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
