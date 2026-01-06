// src/components/settings/TaxSettingsCard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Percent, Save } from 'lucide-react';
import { useReportSettings } from '@/hooks/useReportSettings';

export function TaxSettingsCard() {
  const { settings, loading, updateSettings } = useReportSettings();
  const [taxRate, setTaxRate] = useState(settings.tax_rate);
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTaxRate(settings.tax_rate);
    setTaxEnabled(settings.tax_enabled);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({
      tax_rate: taxRate,
      tax_enabled: taxEnabled,
    });
    setSaving(false);
  };

  const hasChanges = taxRate !== settings.tax_rate || taxEnabled !== settings.tax_enabled;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Cargando configuración...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Configuración de Impuestos
        </CardTitle>
        <CardDescription>
          Configura la tasa de impuesto para el Estado de Resultados anual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="tax-enabled">Aplicar impuesto</Label>
            <p className="text-sm text-muted-foreground">
              Habilita el cálculo de impuesto en el Estado de Resultados anual
            </p>
          </div>
          <Switch
            id="tax-enabled"
            checked={taxEnabled}
            onCheckedChange={setTaxEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax-rate">Tasa de Impuesto (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-32"
              disabled={!taxEnabled}
            />
            <span className="text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ej: 25% para Impuesto sobre la Renta
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardContent>
    </Card>
  );
}
