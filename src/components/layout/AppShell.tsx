// src/components/layout/AppShell.tsx
import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { Eye, Settings, Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isOwner, isViewer, isReadOnly, permissions, loading } = useUserAccess();

  // Build navigation items based on user role and permissions
  const getNavItems = () => {
    const items: { path: string; label: string }[] = [];

    if (isViewer) {
      // Viewer: show only permitted sections
      items.push({ path: '/viewer-dashboard', label: 'Panel' });
      if (permissions.can_view_accounts) items.push({ path: '/accounts', label: 'Plan de Cuentas' });
      if (permissions.can_view_journal) items.push({ path: '/journal', label: 'Libro Diario' });
      if (permissions.can_view_auxiliary) items.push({ path: '/auxiliary-ledgers', label: 'Libros Auxiliares' });
      if (permissions.can_view_ledger) items.push({ path: '/ledger', label: 'Libro Mayor' });
      if (permissions.can_view_reports) items.push({ path: '/reports', label: 'Reportes' });
    } else {
      // Owner: show all sections (except Embarques/Inventario which will be in dropdown)
      items.push({ path: '/accounts', label: 'Plan de Cuentas' });
      items.push({ path: '/journal', label: 'Libro Diario' });
      items.push({ path: '/auxiliary-ledgers', label: 'Libros Auxiliares' });
      items.push({ path: '/ledger', label: 'Libro Mayor' });
      items.push({ path: '/reports', label: 'Reportes' });
    }

    return items;
  };

  const navItems = getNavItems();
  const isInventoryMenuActive = location.pathname === '/shipments' || location.pathname === '/inventory';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold">App Contable</h1>
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full">
                <Eye className="w-3 h-3" />
                Solo lectura
              </span>
            )}
          </div>
          
          <nav className="flex items-center space-x-1">
            {!loading && navItems.map((item) => (
              <Button
                key={item.path}
                asChild
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
              >
                <Link to={item.path}>{item.label}</Link>
              </Button>
            ))}
            
            {/* Dropdown for Embarques/Inventario (owner only) */}
            {!loading && isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isInventoryMenuActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Package className="h-4 w-4" />
                    Inventario
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/shipments')}>
                    Embarques
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/inventory')}>
                    Inventario
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Settings icon (owner only) */}
            {!loading && isOwner && (
              <Button
                variant={location.pathname === '/settings' ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="ml-4"
            >
              Cerrar Sesión
            </Button>
          </nav>
        </div>
      </header>
      
      <main className="container px-6 py-6">
        <Outlet />
      </main>
      
      <footer className="border-t bg-card/30 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {isReadOnly 
              ? "Modo de solo lectura — Estás viendo datos compartidos contigo."
              : "Persistencia local por defecto. Si Supabase está configurado en Lovable, se usa automáticamente (lazy)."
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
