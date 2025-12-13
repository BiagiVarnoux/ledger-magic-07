// src/components/journal/JournalFilters.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Account } from '@/accounting/types';

export interface JournalFilters {
  searchText: string;
  dateFrom: string;
  dateTo: string;
  accountId: string;
  minAmount: string;
  maxAmount: string;
  showVoided: 'all' | 'only_voided' | 'exclude_voided';
}

interface JournalFiltersProps {
  filters: JournalFilters;
  accounts: Account[];
  onFiltersChange: (filters: JournalFilters) => void;
  onClearFilters: () => void;
}

export const defaultFilters: JournalFilters = {
  searchText: '',
  dateFrom: '',
  dateTo: '',
  accountId: '',
  minAmount: '',
  maxAmount: '',
  showVoided: 'all',
};

export function JournalFiltersComponent({
  filters,
  accounts,
  onFiltersChange,
  onClearFilters,
}: JournalFiltersProps) {
  const updateFilter = <K extends keyof JournalFilters>(key: K, value: JournalFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = 
    filters.searchText || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.accountId || 
    filters.minAmount || 
    filters.maxAmount || 
    filters.showVoided !== 'all';

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros de búsqueda</span>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="w-4 h-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Text search */}
        <div className="space-y-1">
          <Label className="text-xs">Buscar en glosa</Label>
          <Input
            placeholder="Texto en glosa o ID..."
            value={filters.searchText}
            onChange={e => updateFilter('searchText', e.target.value)}
          />
        </div>

        {/* Date range */}
        <div className="space-y-1">
          <Label className="text-xs">Fecha desde</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={e => updateFilter('dateFrom', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fecha hasta</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={e => updateFilter('dateTo', e.target.value)}
          />
        </div>

        {/* Account filter */}
        <div className="space-y-1">
          <Label className="text-xs">Cuenta</Label>
          <Select 
            value={filters.accountId || "all"} 
            onValueChange={val => updateFilter('accountId', val === 'all' ? '' : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las cuentas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.id} - {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount range */}
        <div className="space-y-1">
          <Label className="text-xs">Monto mínimo</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={filters.minAmount}
            onChange={e => updateFilter('minAmount', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Monto máximo</Label>
          <Input
            type="number"
            placeholder="Sin límite"
            value={filters.maxAmount}
            onChange={e => updateFilter('maxAmount', e.target.value)}
          />
        </div>

        {/* Voided filter */}
        <div className="space-y-1">
          <Label className="text-xs">Estado de asientos</Label>
          <Select 
            value={filters.showVoided} 
            onValueChange={val => updateFilter('showVoided', val as JournalFilters['showVoided'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="only_voided">Solo anulados</SelectItem>
              <SelectItem value="exclude_voided">Excluir anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
