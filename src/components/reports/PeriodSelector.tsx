// src/components/reports/PeriodSelector.tsx
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Quarter, getAllQuartersFromStart } from '@/accounting/quarterly-utils';
import { Label } from '@/components/ui/label';

export type PeriodType = 'quarterly' | 'annual';

export interface YearPeriod {
  year: number;
  label: string;
  startDate: string;
  endDate: string;
}

interface PeriodSelectorProps {
  periodType: PeriodType;
  onPeriodTypeChange: (type: PeriodType) => void;
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  availableQuarters: Quarter[];
  showPeriodInfo?: boolean;
  currentQuarter?: Quarter;
  currentYear?: YearPeriod;
}

export function getAvailableYears(startYear: number = 2020): YearPeriod[] {
  const currentYear = new Date().getFullYear();
  const years: YearPeriod[] = [];
  
  for (let year = currentYear; year >= startYear; year--) {
    years.push({
      year,
      label: `Año ${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  }
  
  return years;
}

export function getYearPeriod(year: number): YearPeriod {
  return {
    year,
    label: `Año ${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

export function isDateInYear(date: string, year: number): boolean {
  return date >= `${year}-01-01` && date <= `${year}-12-31`;
}

export function PeriodSelector({
  periodType,
  onPeriodTypeChange,
  selectedQuarter,
  onQuarterChange,
  selectedYear,
  onYearChange,
  availableQuarters,
  showPeriodInfo = true,
  currentQuarter,
  currentYear,
}: PeriodSelectorProps) {
  const availableYears = getAvailableYears();

  return (
    <div className="space-y-4">
      {/* Period Type Toggle */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Tipo de período:</Label>
        <Tabs value={periodType} onValueChange={(v) => onPeriodTypeChange(v as PeriodType)}>
          <TabsList className="grid w-[280px] grid-cols-2">
            <TabsTrigger value="quarterly">Trimestral</TabsTrigger>
            <TabsTrigger value="annual">Anual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4">
        {periodType === 'quarterly' ? (
          <Select value={selectedQuarter} onValueChange={onQuarterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar trimestre" />
            </SelectTrigger>
            <SelectContent>
              {availableQuarters.map((q) => (
                <SelectItem key={q.label} value={q.label}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => onYearChange(parseInt(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar año" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y.year} value={y.year.toString()}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Period Info */}
        {showPeriodInfo && (
          <div className="text-sm text-muted-foreground">
            {periodType === 'quarterly' && currentQuarter && (
              <span>
                Del {currentQuarter.startDate} al {currentQuarter.endDate}
              </span>
            )}
            {periodType === 'annual' && currentYear && (
              <span>
                Del {currentYear.startDate} al {currentYear.endDate}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
