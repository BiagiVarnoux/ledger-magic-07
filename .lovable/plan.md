

# Fase 3: Flujo de Efectivo — Método Indirecto (NIC 7)

## Resumen

Agregar el método indirecto al reporte de Flujo de Efectivo, que parte de la **Utilidad Neta** del Estado de Resultados y la ajusta por partidas no monetarias y variaciones en capital de trabajo. El usuario podrá elegir entre método directo (actual) o indirecto. Se reutiliza `computeIncomeStatement` del EE.RR. para obtener la Utilidad Neta.

## Estructura del Método Indirecto (NIC 7.18-20)

```text
UTILIDAD NETA (del EE.RR.)

+ Ajustes por partidas no monetarias:
  + Depreciación y Amortización (es_partida_no_monetaria = true)
  + Provisiones (subclasificacion heurística)
  + Pérdidas/ganancias por disposición de activos

= Flujo Operativo antes de cambios en Capital de Trabajo

+/- Variaciones en Capital de Trabajo:
  - (Aumento) / Disminución en Cuentas por Cobrar
  - (Aumento) / Disminución en Inventarios
  + Aumento / (Disminución) en Cuentas por Pagar
  (usa es_capital_trabajo = true o heurísticas)

= FLUJO NETO DE OPERACIÓN

+/- Actividades de Inversión (igual que método directo)
+/- Actividades de Financiación (igual que método directo)

= VARIACIÓN NETA DE EFECTIVO
+ Saldo Inicial
= SALDO FINAL
```

## Cambios

### 1. `src/components/reports/CashFlowReport.tsx` (refactor mayor)

- Agregar toggle "Método Directo / Método Indirecto" en el header
- **Método Indirecto — Actividades de Operación:**
  - Importar y usar `computeIncomeStatement` (extraer como función reutilizable si es necesario) para obtener `utilidadNeta`
  - Calcular ajustes no monetarios: filtrar cuentas con `es_partida_no_monetaria === true` y sumar sus movimientos en el periodo (D&A, provisiones)
  - Calcular variaciones en capital de trabajo: para cada cuenta con `es_capital_trabajo === true` (o tipo ACTIVO corriente / PASIVO corriente), comparar saldo al inicio vs fin del periodo. Para activos: aumento = negativo. Para pasivos: aumento = positivo
  - Usar `clasificacion_flujo` como fuente primaria para clasificar cuentas en operación/inversión/financiación, con fallback a `classifyMovementNIC7` existente
- **Inversión y Financiación**: reutilizar la lógica actual del método directo (movimientos de efectivo clasificados por contraparte)
- Mantener el método directo intacto como opción

### 2. `src/services/pdfService.ts`

- Extender `CashFlowNIIFData` con campos del método indirecto: `metodo`, `utilidadNeta`, `ajustesNoMonetarios`, `variacionesCapitalTrabajo`, `flujoOperativoIndirecto`
- Actualizar `exportCashFlowNIIFToPDF` para renderizar la estructura indirecta cuando `metodo === 'indirecto'`

## Campos de Account utilizados

| Campo | Uso |
|-------|-----|
| `is_cash_equivalent` | Identificar cuentas de efectivo |
| `es_partida_no_monetaria` | Ajustes por D&A, provisiones |
| `es_capital_trabajo` | Variaciones en capital de trabajo |
| `clasificacion_flujo` | Clasificar en operación/inversión/financiación |
| `is_current` | Distinguir corriente vs no corriente para capital de trabajo |
| `type` | Determinar signo de variación (activo vs pasivo) |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/reports/CashFlowReport.tsx` | Toggle de método, lógica completa del método indirecto |
| `src/services/pdfService.ts` | Soporte PDF para método indirecto |

No se necesitan cambios en base de datos.

