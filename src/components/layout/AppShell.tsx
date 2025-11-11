// src/components/layout/AppShell.tsx
import React, { Suspense } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';

export function AppShell() {
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { path: '/accounts', label: 'Plan de Cuentas' },
    { path: '/journal', label: 'Libro Diario' },
    { path: '/auxiliary-ledgers', label: 'Libros Auxiliares' },
    { path: '/ledger', label: 'Libro Mayor' },
    { path: '/reports', label: 'Reportes' },
    { path: '/settings', label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold">App Contable</h1>
            <span className="text-sm text-muted-foreground">— Supabase/LocalStorage</span>
          </div>
          
          <nav className="flex items-center space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                asChild
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
              >
                <Link to={item.path}>{item.label}</Link>
              </Button>
            ))}
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
        <Suspense
          fallback={(
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Cargando módulo...
            </div>
          )}
        >
          <Outlet />
        </Suspense>
      </main>
      
      <footer className="border-t bg-card/30 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Persistencia local por defecto. Si Supabase está configurado en Lovable, se usa automáticamente (lazy).
          </p>
        </div>
      </footer>
    </div>
  );
}
