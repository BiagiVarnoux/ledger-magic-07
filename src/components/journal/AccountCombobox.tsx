// src/components/journal/AccountCombobox.tsx
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Account } from '@/accounting/types';

interface AccountComboboxProps {
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
}

export function AccountCombobox({ value, onChange, accounts }: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedAccount = value ? accounts.find(account => account.id === value) : undefined;
  const selectableAccounts = useMemo(
    () => accounts.filter(account => account.is_active || account.id === value),
    [accounts, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-[240px] justify-between',
            !selectedAccount && 'text-muted-foreground'
          )}
        >
          {selectedAccount ? `${selectedAccount.id} — ${selectedAccount.name}` : 'Selecciona cuenta'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0">
        <Command>
          <CommandInput placeholder="Buscar cuenta..." />
          <CommandEmpty>No se encontraron cuentas.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {selectableAccounts.map(account => (
                <CommandItem
                  key={account.id}
                  value={`${account.id} ${account.name}`}
                  onSelect={() => {
                    onChange(account.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', account.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono">{account.id}</span>
                  <span className="ml-2 truncate">{account.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
