import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountingProvider } from "./accounting/AccountingProvider";
import { AppShell } from "./components/layout/AppShell";
import AccountsPage from "./pages/accounts/Index";
import JournalPage from "./pages/journal/Index";
import LedgerPage from "./pages/ledger/Index";
import ReportsPage from "./pages/reports/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <BrowserRouter>
      <AccountingProvider>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/accounts" replace />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AccountingProvider>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
