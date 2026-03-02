

# Plan: Eliminar configuración de impuestos y usar cuentas clasificadas

## Resumen

Eliminar el sistema de tasa de impuesto configurable (`tax_rate`, `tax_enabled` en settings) y en su lugar usar directamente las cuentas contables con `clasificacion_resultado = 'impuesto'` para calcular el impuesto en el Estado de Resultados. Esto es más correcto contablemente: el impuesto se registra como un asiento en el libro diario contra cuentas de tipo GASTO con clasificación "impuesto".

## Cambios

### 1. Eliminar `TaxSettingsCard` del Settings

**Archivo**: `src/pages/settings/Index.tsx`
- Quitar el import y uso de `<TaxSettingsCard />`

**Archivo**: `src/components/settings/TaxSettingsCard.tsx`
- Eliminar el archivo completo (ya no se necesita)

### 2. Simplificar `useReportSettings`

**Archivo**: `src/hooks/useReportSettings.ts`
- Quitar `tax_rate` y `tax_enabled` de la interface `ReportSettings` y de `defaultSettings`
- Mantener los keywords que aún se usan como fallback

### 3. Simplificar cálculo de impuesto en Income Statement

**Archivo**: `src/components/reports/IncomeStatementReport.tsx`
- En `computeIncomeStatement`: el impuesto se toma **solo** de las cuentas clasificadas como `impuesto` (ya clasificadas en `maps.impuesto`). Eliminar el fallback de `settings.tax_rate * utilidadAntesImpuestos`
- Quitar `tasaImpuesto` y `taxEnabled` de la interface `ProfessionalIncomeStatement`
- En el UI: quitar el banner "El cálculo de impuestos está deshabilitado" y la referencia a la tasa porcentual. Mostrar las cuentas de impuesto como filas detalle (igual que cualquier otra sección)
- Agregar una sección "6. IMPUESTOS" con las cuentas individuales de impuesto, similar a las demás secciones

### 4. Actualizar PDF

**Archivo**: `src/services/pdfService.ts`
- En `NIIFIncomeStatementData`: quitar `tasaImpuesto` y `taxEnabled`
- Agregar `impuestosCuentas: AccountDetail[]` para listar las cuentas de impuesto
- En la generación del PDF: mostrar las cuentas de impuesto como filas detalle en lugar de una sola línea con porcentaje

### 5. No se elimina la tabla `report_settings` ni sus columnas

Las columnas `tax_rate`/`tax_enabled` se mantienen en la DB para no romper nada; simplemente se dejan de usar. Los keywords sí se siguen usando.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/settings/TaxSettingsCard.tsx` | Eliminar |
| `src/pages/settings/Index.tsx` | Quitar import y uso de TaxSettingsCard |
| `src/hooks/useReportSettings.ts` | Quitar tax_rate/tax_enabled de la interface |
| `src/components/reports/IncomeStatementReport.tsx` | Simplificar impuesto: solo cuentas clasificadas, nueva sección UI |
| `src/services/pdfService.ts` | Quitar tasaImpuesto/taxEnabled, agregar cuentas de impuesto detalladas |

