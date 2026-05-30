import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/accounting/utils';
import { listCustomers } from '@/domain/customers';
import type { CustomerRow } from '@/domain/customers';
import { CustomerModal } from './CustomerModal';

interface Props {
  value: string | null;
  customerName: string;
  onChange: (customerId: string | null, customerName: string) => void;
  disabled?: boolean;
}

export function CustomerSearchCombobox({ value, customerName, onChange, disabled }: Props) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialName, setModalInitialName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCustomers()
      .then(setCustomers)
      .catch(e => toast.error(e.message || 'Error cargando clientes'))
      .finally(() => setLoading(false));
  }, []);

  // Cuando hay un cliente seleccionado, mostrar su razón social en el input
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === value) ?? null,
    [customers, value]
  );

  const displayValue = value ? (selectedCustomer?.razon_social ?? customerName) : query;

  const filtered = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return customers
      .filter(c =>
        c.razon_social.toLowerCase().includes(q) ||
        (c.nit ?? '').toLowerCase().includes(q) ||
        (c.nombre_corto ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, query]);

  function handleSelect(customer: CustomerRow) {
    onChange(customer.id, customer.razon_social);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange(null, '');
    setQuery('');
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (value) {
      // Si hay selección activa, limpiarla al escribir
      onChange(null, '');
    }
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleCreateClick() {
    setModalInitialName(query);
    setOpen(false);
    setModalOpen(true);
  }

  function handleModalSaved(customer: CustomerRow) {
    setCustomers(prev => [...prev, customer]);
    onChange(customer.id, customer.razon_social);
    setQuery('');
    setModalOpen(false);
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = open && !value && query.length >= 1 && (filtered.length > 0 || query.length >= 3);
  const showCreateOption = open && !value && query.length >= 3;

  return (
    <>
      <div className="relative" ref={containerRef}>
        <div className="relative">
          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <Input
            className="pl-9 pr-8"
            placeholder="Buscar o escribir nombre de cliente..."
            value={value ? (selectedCustomer?.razon_social ?? customerName) : query}
            onChange={handleQueryChange}
            onFocus={() => { if (!value) setOpen(true); }}
            disabled={disabled || loading}
          />
          {value && !disabled && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(showDropdown || showCreateOption) && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
              >
                <div className="font-medium">{c.razon_social}</div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  {c.nit && <span>NIT: {c.nit}</span>}
                  {c.ciudad && <span>{c.ciudad}</span>}
                </div>
              </button>
            ))}
            {query.length >= 3 && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2 text-primary border-t"
                onMouseDown={e => { e.preventDefault(); handleCreateClick(); }}
              >
                <Plus className="w-4 h-4" />
                Crear cliente: <span className="font-medium">{query}</span>
              </button>
            )}
          </div>
        )}

        {selectedCustomer && selectedCustomer.credito_autorizado > 0 && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
              Crédito: Bs {fmt(selectedCustomer.credito_autorizado)}
              {selectedCustomer.dias_credito > 0 && ` · ${selectedCustomer.dias_credito} días`}
            </Badge>
          </div>
        )}
      </div>

      <CustomerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
        initialName={modalInitialName}
      />
    </>
  );
}
