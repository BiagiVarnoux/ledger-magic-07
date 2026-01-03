import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { UserAccessProvider, useUserAccess } from "@/contexts/UserAccessContext";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountingProvider } from "./accounting/AccountingProvider";
import { AppShell } from "./components/layout/AppShell";
import AccountsPage from "./pages/accounts/Index";
import JournalPage from "./pages/journal/Index";
import AuxiliaryLedgersPage from "./pages/auxiliary-ledgers/Index";
import LedgerPage from "./pages/ledger/Index";
import ReportsPage from "./pages/reports/Index";
import SettingsPage from "./pages/settings/Index";
import ViewerDashboardPage from "./pages/viewer-dashboard/Index";
import InventoryPage from "./pages/inventory/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppRoutes() {
  const { isViewer, isOwner, loading } = useUserAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando permisos...</div>
      </div>
    );
  }

  // Determine default route based on role
  const defaultRoute = isViewer ? "/viewer-dashboard" : "/accounts";

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        <Route path="viewer-dashboard" element={<ViewerDashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="auxiliary-ledgers" element={<AuxiliaryLedgersPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        {/* Settings only for owners */}
        {isOwner && <Route path="settings" element={<SettingsPage />} />}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

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
      <UserAccessProvider>
        <AccountingProvider>
          <AppRoutes />
        </AccountingProvider>
      </UserAccessProvider>
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
