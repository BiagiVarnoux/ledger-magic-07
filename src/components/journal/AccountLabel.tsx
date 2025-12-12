// src/components/journal/AccountLabel.tsx
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TYPE_ABBR, signForLine } from '@/accounting/utils';
import { Account } from '@/accounting/types';

interface AccountLabelProps {
  accountId: string;
  accounts: Account[];
  line?: { debit?: string | number; credit?: string | number };
}

export function AccountLabel({ accountId, accounts, line }: AccountLabelProps) {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return <span className="text-muted-foreground">--</span>;

  const abbr = TYPE_ABBR[account.type];
  const sign = line ? signForLine(account, line) : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {abbr}
            {sign && <span className={sign === '+' ? 'text-green-600' : 'text-red-600'}>{sign}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{accountId}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
