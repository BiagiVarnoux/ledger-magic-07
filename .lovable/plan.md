
# Upgrade Profesional de Reportes Financieros (NIIF)

Este es un proyecto grande que se divide en 3 fases. Dado su alcance, se recomienda implementar **fase por fase** para evitar errores y poder validar cada paso.

---

## Auditoria del Estado Actual

### Estado de Resultados - Problemas detectados:

| Aspecto | Estado actual | Requerido |
|---------|--------------|-----------|
| Estructura de ingresos | Un solo grupo "Ingresos por Ventas" | Separar operativos vs no operativos, devoluciones |
| Clasificacion de gastos | 3 categorias (Costo Ventas, Operativo, Otro) | Falta separar: depreciacion, amortizacion, financieros, extraordinarios |
| EBITDA | No existe | Se calcula como Utilidad Bruta - (Operativos sin D&A) |
| EBIT | Existe como "Utilidad Operativa" pero incluye "Otros Gastos" | EBIT = Utilidad Bruta - Total Gastos Operativos (incluyendo D&A) |
| Resultado Financiero | No existe como seccion separada | Ingresos financieros - Gastos financieros |
| EBT | Existe como "Utilidad antes de impuestos" pero mezcla financieros con otros | EBT = EBIT +/- Resultado Financiero |
| Comparativo | No implementado | Mostrar periodo actual vs anterior |
| Partidas extraordinarias | No se separan | Mostrar aparte si existen |

### Flujo de Efectivo - Problemas detectados:

| Aspecto | Estado actual | Requerido |
|---------|--------------|-----------|
| Metodo | **Directo** (rastrea movimientos de caja) | **Indirecto** (parte de Utilidad Neta + ajustes) |
| Partidas no monetarias | No se ajustan | Sumar depreciacion, amortizacion, provisiones |
| Capital de trabajo | No se calculan variaciones | Variacion en CxC, inventarios, CxP entre periodos |
| Conciliacion con Balance | No se valida | Saldo final debe = cuentas de efectivo del Balance General |
| Alerta de descuadre | No existe | Generar alerta automatica si no coincide |

### Plan de Cuentas - Campos faltantes:

| Campo actual | Campos requeridos nuevos |
|-------------|------------------------|
| `expense_category` (3 valores) | `clasificacion_resultado` (6 valores: ingreso_operativo, ingreso_no_operativo, costo_ventas, gasto_operativo, gasto_no_operativo, impuesto) |
| `is_cash_equivalent` | `clasificacion_flujo` (operacion, inversion, financiamiento, no_aplica) |
| `is_current` | `es_partida_no_monetaria`, `es_capital_trabajo`, `es_financiera`, `es_extraordinaria`, `afecta_ebitda` |

---

## FASE 1: Clasificacion Avanzada en Plan de Cuentas

### 1.1 Migracion de base de datos

Agregar nuevas columnas a la tabla `accounts`:

```sql
ALTER TABLE accounts 
  ADD COLUMN clasificacion_resultado text DEFAULT NULL,
  ADD COLUMN subclasificacion_resultado text DEFAULT NULL,
  ADD COLUMN clasificacion_flujo text DEFAULT 'no_aplica',
  ADD COLUMN es_partida_no_monetaria boolean DEFAULT false,
  ADD COLUMN es_capital_trabajo boolean DEFAULT false,
  ADD COLUMN es_financiera boolean DEFAULT false,
  ADD COLUMN es_extraordinaria boolean DEFAULT false,
  ADD COLUMN afecta_ebitda boolean DEFAULT true;
```

Valores validos para `clasificacion_resultado`:
- `ingreso_operativo`, `ingreso_no_operativo`, `costo_ventas`, `gasto_operativo`, `gasto_no_operativo`, `impuesto`

Valores validos para `clasificacion_flujo`:
- `operacion`, `inversion`, `financiamiento`, `no_aplica`

### 1.2 Auto-migrar datos existentes

Ejecutar UPDATE para mapear las clasificaciones actuales a las nuevas:

```sql
-- Mapear expense_category existente
UPDATE accounts SET clasificacion_resultado = 'costo_ventas' 
  WHERE expense_category = 'COSTO_VENTAS';
UPDATE accounts SET clasificacion_resultado = 'gasto_operativo' 
  WHERE expense_category = 'GASTO_OPERATIVO';
UPDATE accounts SET clasificacion_resultado = 'gasto_no_operativo' 
  WHERE expense_category = 'OTRO_GASTO';
-- Ingresos existentes -> ingreso_operativo por defecto
UPDATE accounts SET clasificacion_resultado = 'ingreso_operativo' 
  WHERE type = 'INGRESO' AND clasificacion_resultado IS NULL;
-- Gastos sin clasificar -> gasto_operativo por defecto
UPDATE accounts SET clasificacion_resultado = 'gasto_operativo' 
  WHERE type = 'GASTO' AND clasificacion_resultado IS NULL;
```

### 1.3 Actualizar tipos TypeScript

**Archivo**: `src/accounting/types.ts`

Agregar los nuevos tipos:

```typescript
export const CLASIFICACION_RESULTADO = [
  'ingreso_operativo', 'ingreso_no_operativo', 
  'costo_ventas', 'gasto_operativo', 'gasto_no_operativo', 'impuesto'
] as const;
export type ClasificacionResultado = typeof CLASIFICACION_RESULTADO[number];

export const CLASIFICACION_FLUJO = [
  'operacion', 'inversion', 'financiamiento', 'no_aplica'
] as const;
export type ClasificacionFlujo = typeof CLASIFICACION_FLUJO[number];
```

Extender la interface `Account` con los nuevos campos.

### 1.4 Actualizar formulario del Plan de Cuentas

**Archivo**: `src/pages/accounts/Index.tsx`

- Reemplazar el selector de `expense_category` actual por el nuevo `clasificacion_resultado` (visible para tipos INGRESO y GASTO).
- Agregar selector de `clasificacion_flujo` (visible para ACTIVO, PASIVO, PATRIMONIO).
- Agregar checkboxes para las propiedades booleanas (no monetaria, capital de trabajo, financiera, extraordinaria, afecta EBITDA).
- Mostrar badges en la tabla con las nuevas clasificaciones.
- Mantener retrocompatibilidad: si `clasificacion_resultado` es null, el sistema sigue usando `expense_category` + heuristicas como fallback.

### 1.5 Actualizar data-adapter

**Archivo**: `src/accounting/data-adapter.ts`

Incluir los nuevos campos en las operaciones de lectura/escritura de cuentas tanto en el adaptador Local como en el Supabase.

---

## FASE 2: Estado de Resultados Profesional

### 2.1 Reestructurar calculo del Estado de Resultados

**Archivo**: `src/components/reports/IncomeStatementReport.tsx`

Nueva estructura de datos:

```typescript
interface ProfessionalIncomeStatement {
  // 1. INGRESOS OPERATIVOS
  ingresosOperativos: AccountDetail[];
  devoluciones: AccountDetail[];        // subclasificacion = 'devolucion'
  ingresosNetos: number;
  otrosIngresosOperativos: AccountDetail[];
  totalIngresosOperativos: number;

  // 2. COSTO DE VENTAS
  costoMercaderia: AccountDetail[];
  costoProduccion: AccountDetail[];
  costoServicios: AccountDetail[];
  totalCostoVentas: number;

  // UTILIDAD BRUTA
  utilidadBruta: number;
  margenBruto: number;

  // 3. GASTOS OPERATIVOS
  gastosAdministrativos: AccountDetail[];
  gastosVentas: AccountDetail[];
  depreciacion: AccountDetail[];        // es_partida_no_monetaria + keyword
  amortizacion: AccountDetail[];
  otrosGastosOperativos: AccountDetail[];
  totalGastosOperativos: number;

  // EBITDA
  ebitda: number;                       // Utilidad Bruta - (Operativos - D&A)
  margenEbitda: number;

  // EBIT
  ebit: number;                         // Utilidad Bruta - Total Gastos Operativos
  margenOperativo: number;

  // 4. RESULTADO FINANCIERO
  ingresosFinancieros: AccountDetail[];  // clasificacion = ingreso_no_operativo + es_financiera
  gastosFinancieros: AccountDetail[];    // clasificacion = gasto_no_operativo + es_financiera
  resultadoFinanciero: number;

  // EBT
  ebt: number;                          // EBIT +/- Resultado Financiero

  // PARTIDAS EXTRAORDINARIAS (si existen)
  extraordinarios: AccountDetail[];
  totalExtraordinarios: number;

  // IMPUESTO
  impuesto: number;

  // UTILIDAD NETA
  utilidadNeta: number;
  margenNeto: number;

  // COMPARATIVO (periodo anterior)
  periodoAnterior?: ProfessionalIncomeStatement;
}
```

La logica de clasificacion usara `clasificacion_resultado` como fuente primaria, con `expense_category` + heuristicas como fallback para datos historicos. La `subclasificacion_resultado` libre permitira agrupar cuentas dentro de cada seccion (ej. administrativos vs ventas).

### 2.2 Agregar comparativo con periodo anterior

Calcular el mismo reporte para el periodo inmediatamente anterior (trimestre anterior o ano anterior) y mostrar columnas lado a lado:

```
| Concepto            | Periodo Actual | Periodo Anterior | Variacion |
```

### 2.3 Actualizar la tabla UI

Renderizar las nuevas secciones con subtotales claros:
- Seccion EBITDA con fondo destacado entre Utilidad Bruta y EBIT
- Seccion Resultado Financiero separada
- EBT como linea diferenciada
- Columna de comparativo cuando haya datos del periodo anterior

### 2.4 Actualizar PDF

**Archivo**: `src/services/pdfService.ts`

Actualizar `NIIFIncomeStatementData` y `exportIncomeStatementNIIFToPDF` para incluir EBITDA, resultado financiero, EBT, comparativo, y partidas extraordinarias.

---

## FASE 3: Flujo de Efectivo Metodo Indirecto

### 3.1 Reescribir calculo del Flujo de Efectivo

**Archivo**: `src/components/reports/CashFlowReport.tsx`

Cambiar de metodo directo a **metodo indirecto**:

```typescript
interface IndirectCashFlow {
  // 1. ACTIVIDADES OPERATIVAS
  utilidadNeta: number;
  
  // Ajustes por partidas no monetarias
  ajustesNoMonetarios: CashFlowItem[];  // Filtra cuentas con es_partida_no_monetaria=true
  totalAjustesNoMonetarios: number;
  
  // Variaciones en capital de trabajo
  variacionesCapitalTrabajo: CashFlowItem[];  // Compara saldos inicio vs fin periodo
  totalVariacionesCapitalTrabajo: number;
  
  flujoOperativo: number;
  
  // 2. ACTIVIDADES DE INVERSION
  inversionDetalle: CashFlowItem[];     // clasificacion_flujo = 'inversion'
  flujoInversion: number;
  
  // 3. ACTIVIDADES DE FINANCIAMIENTO
  financiamientoDetalle: CashFlowItem[];  // clasificacion_flujo = 'financiamiento'
  flujoFinanciamiento: number;
  
  // VARIACION NETA
  variacionNeta: number;
  
  // CONCILIACION
  saldoInicialEfectivo: number;
  saldoFinalEfectivo: number;
  saldoFinalBalanceGeneral: number;     // Calculado independientemente del Balance
  alertaDescuadre: boolean;             // true si no coinciden
}
```

### 3.2 Logica de calculo del metodo indirecto

1. **Utilidad Neta**: Reutilizar el calculo del Estado de Resultados para el mismo periodo.
2. **Ajustes no monetarios**: Buscar cuentas con `es_partida_no_monetaria = true` y sumar sus movimientos del periodo (depreciacion, amortizacion, provisiones, deterioros).
3. **Variaciones en capital de trabajo**: Para cada cuenta con `es_capital_trabajo = true`:
   - Calcular saldo al inicio del periodo
   - Calcular saldo al final del periodo
   - La variacion = saldo_final - saldo_inicio
   - Para activos corrientes: aumento = salida de efectivo (negativo)
   - Para pasivos corrientes: aumento = entrada de efectivo (positivo)
4. **Actividades de inversion**: Movimientos netos del periodo en cuentas con `clasificacion_flujo = 'inversion'`.
5. **Actividades de financiamiento**: Movimientos netos del periodo en cuentas con `clasificacion_flujo = 'financiamiento'`.
6. **Conciliacion**: Comparar saldo final calculado vs suma de cuentas con `is_cash_equivalent = true` en el Balance General a la misma fecha.

### 3.3 Alerta de descuadre

Si el saldo final de efectivo calculado por el flujo no coincide con las cuentas de caja/banco del Balance General, mostrar un banner de alerta rojo con el monto de la diferencia.

### 3.4 Actualizar UI

- Mostrar "Metodo Indirecto" en el encabezado
- Secciones claras: Utilidad Neta -> Ajustes -> Variaciones -> Flujo Operativo
- Seccion de conciliacion al final con verificacion visual
- Mantener los ratios financieros existentes

### 3.5 Actualizar PDF del Flujo de Efectivo

**Archivo**: `src/services/pdfService.ts`

Actualizar `CashFlowNIIFData` y `exportCashFlowNIIFToPDF` para reflejar la estructura del metodo indirecto.

---

## Resumen de archivos a modificar

| Archivo | Cambios |
|---------|---------|
| **Base de datos** | Migracion: 8 nuevas columnas en `accounts` + UPDATE de datos existentes |
| `src/accounting/types.ts` | Nuevos tipos y campos en interface Account |
| `src/pages/accounts/Index.tsx` | Formulario con nuevas clasificaciones y checkboxes |
| `src/accounting/data-adapter.ts` | Incluir nuevos campos en lectura/escritura |
| `src/components/reports/IncomeStatementReport.tsx` | Reestructura completa: EBITDA, EBIT, EBT, financieros, comparativo |
| `src/components/reports/CashFlowReport.tsx` | Reescribir de metodo directo a indirecto |
| `src/services/pdfService.ts` | Actualizar interfaces y funciones de exportacion PDF |

---

## Retrocompatibilidad garantizada

- Las nuevas columnas tienen valores por defecto (`NULL`, `false`, `'no_aplica'`)
- Los datos existentes no se pierden: la migracion SQL los mapea automaticamente
- Los fallbacks por heuristicas siguen funcionando si las nuevas clasificaciones no se han configurado
- No se eliminan columnas existentes (`expense_category`, `is_cash_equivalent`, `is_current`)

---

## Recomendacion de implementacion

Dado el alcance, se sugiere implementar en orden:
1. **Fase 1 primero** (clasificacion de cuentas) - es requisito para las fases 2 y 3
2. **Fase 2** (Estado de Resultados) - depende de las nuevas clasificaciones
3. **Fase 3** (Flujo de Efectivo) - depende de la Utilidad Neta de la Fase 2
