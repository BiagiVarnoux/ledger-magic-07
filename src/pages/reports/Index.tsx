// src/pages/reports/Index.tsx
import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccounting } from '@/accounting/AccountingProvider';
import { todayISO } from '@/accounting/utils';
import { getCurrentQuarter, getAllQuartersFromStart, parseQuarterString } from '@/accounting/quarterly-utils';

// Report components
import { TrialBalanceReport } from '@/components/reports/TrialBalanceReport';
import { IncomeStatementReport } from '@/components/reports/IncomeStatementReport';
import { BalanceSheetReport } from '@/components/reports/BalanceSheetReport';

export default function ReportsPage() {
  const { accounts, entries } = useAccounting();
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter().label);
  const [bsDate, setBsDate] = useState<string>(todayISO());
  
  // Available quarters for selection
  const availableQuarters = useMemo(() => getAllQuartersFromStart(2020), []);
  const currentQuarter = useMemo(() => parseQuarterString(selectedQuarter), [selectedQuarter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes Financieros</h1>

      <Tabs defaultValue="trial-balance" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="trial-balance">Balance de Comprobación</TabsTrigger>
          <TabsTrigger value="income-statement">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance General</TabsTrigger>
        </TabsList>

        {/* Balance de Comprobación */}
        <TabsContent value="trial-balance" className="mt-6">
          <TrialBalanceReport
            accounts={accounts}
            entries={entries}
            selectedQuarter={selectedQuarter}
            onQuarterChange={setSelectedQuarter}
            availableQuarters={availableQuarters}
            currentQuarter={currentQuarter}
          />
        </TabsContent>

        {/* Estado de Resultados */}
        <TabsContent value="income-statement" className="mt-6">
          <IncomeStatementReport
            accounts={accounts}
            entries={entries}
            selectedQuarter={selectedQuarter}
            onQuarterChange={setSelectedQuarter}
            availableQuarters={availableQuarters}
            currentQuarter={currentQuarter}
          />
        </TabsContent>

        {/* Balance General */}
        <TabsContent value="balance-sheet" className="mt-6">
          <BalanceSheetReport
            accounts={accounts}
            entries={entries}
            bsDate={bsDate}
            onBsDateChange={setBsDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
