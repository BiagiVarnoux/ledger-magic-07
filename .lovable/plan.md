
## Plan: Corregir Discrepancia de Decimales en Balance General

### Diagnóstico del Problema

He identificado la causa raíz del problema:

1. **Datos contaminados en la base de datos**: Los valores en `journal_lines` contienen errores de punto flotante heredados de JavaScript:
   - `44762.399999999994` en lugar de `44762.40`
   - `43619.799999999996` en lugar de `43619.80`

2. **Operaciones sin redondeo**: Las sumas de JavaScript acumulan errores de precisión de punto flotante (IEEE 754), y no hay redondeo al guardar ni al calcular.

3. **Impacto en cascada**: Estos errores microscópicos se acumulan a lo largo de muchas transacciones, resultando en diferencias de céntimos en los totales del Balance General.

---

### Solución en 3 Partes

#### Parte 1: Crear Función de Redondeo Centralizada

**Archivo**: `src/accounting/utils.ts`

Crear una función `round2` para redondear todos los cálculos financieros a 2 decimales:

```typescript
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

#### Parte 2: Aplicar Redondeo en Puntos Críticos

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `src/accounting/data-adapter.ts` | Redondear `debit` y `credit` al guardar asientos |
| `src/components/reports/BalanceSheetReport.tsx` | Redondear saldos individuales y totales |
| `src/components/reports/IncomeStatementReport.tsx` | Redondear cálculos de ingresos/gastos |
| `src/components/reports/CashFlowReport.tsx` | Redondear movimientos de efectivo |
| `src/hooks/useJournalForm.ts` | Redondear valores al procesar líneas |

**Puntos de redondeo clave**:
1. Al guardar `debit` y `credit` en `journal_lines` → redondear a 2 decimales
2. Al calcular `signedBalanceFor` → redondear resultado
3. Al sumar saldos en reportes → redondear subtotales y totales
4. Al calcular `utilidadAcumulada` → redondear el resultado

#### Parte 3: Corregir Datos Existentes

**Migración SQL opcional** para limpiar datos contaminados:

```sql
UPDATE journal_lines 
SET debit = ROUND(debit::numeric, 2),
    credit = ROUND(credit::numeric, 2);
```

---

### Cambios Específicos por Archivo

#### `src/accounting/utils.ts`
- Agregar función `round2(n: number): number`
- Modificar `signedBalanceFor` para usar `round2`

#### `src/accounting/data-adapter.ts` (línea ~233)
Cambiar:
```typescript
const payload = e.lines.map(l => ({
  entry_id: e.id,
  account_id: l.account_id,
  debit: l.debit,
  credit: l.credit,
  ...
}));
```
A:
```typescript
const payload = e.lines.map(l => ({
  entry_id: e.id,
  account_id: l.account_id,
  debit: round2(l.debit),
  credit: round2(l.credit),
  ...
}));
```

#### `src/components/reports/BalanceSheetReport.tsx`
- Usar `round2` en el cálculo de `bal` (línea 133)
- Usar `round2` en los totales (líneas 183-192)
- Usar `round2` en `utilidadAcumulada` (línea 168)

#### `src/components/reports/IncomeStatementReport.tsx`
- Redondear saldos de cuentas al calcular
- Redondear totales y márgenes

#### `src/components/reports/CashFlowReport.tsx`
- Redondear cálculos de flujos de efectivo

---

### Prevención de Errores Futuros

1. **Redondeo al entrada**: Todo dato financiero se redondea al guardarse
2. **Redondeo en cálculos**: Cada suma/resta de montos usa `round2`
3. **Validación visual**: El check de ecuación contable ahora debería mostrar `0.00 ✓ Cuadra`

---

### Resumen de Archivos

| Archivo | Acción |
|---------|--------|
| `src/accounting/utils.ts` | Agregar `round2()` |
| `src/accounting/data-adapter.ts` | Redondear al guardar asientos |
| `src/components/reports/BalanceSheetReport.tsx` | Redondear cálculos |
| `src/components/reports/IncomeStatementReport.tsx` | Redondear cálculos |
| `src/components/reports/CashFlowReport.tsx` | Redondear cálculos |
| `src/hooks/useJournalForm.ts` | Redondear en validación |
| Nueva migración SQL | Limpiar datos existentes (opcional) |
