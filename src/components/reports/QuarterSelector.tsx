// src/components/reports/QuarterSelector.tsx
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Quarter } from '@/accounting/quarterly-utils';

interface QuarterSelectorProps {
  value: string;
  onChange: (value: string) => void;
  availableQuarters: Quarter[];
  showPeriod?: boolean;
  currentQuarter?: { startDate: string; endDate: string };
}

export function QuarterSelector({
  value,
  onChange,
  availableQuarters,
  showPeriod = false,
  currentQuarter,
}: QuarterSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div>
          <Label>Trimestre:</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar trimestre" />
            </SelectTrigger>
            <SelectContent>
              {availableQuarters.map((quarter) => (
                <SelectItem key={`${quarter.year}-Q${quarter.quarter}`} value={quarter.label}>
                  {quarter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showPeriod && currentQuarter && (
        <div className="text-sm text-muted-foreground">
          Período: {currentQuarter.startDate} - {currentQuarter.endDate}
        </div>
      )}
    </div>
  );
}
