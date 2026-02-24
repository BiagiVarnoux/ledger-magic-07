

# Fase 2: Estado de Resultados Profesional (NIIF)

## Resumen

Reestructurar completamente el Estado de Resultados para incluir EBITDA, EBIT, EBT, Resultado Financiero, partidas extraordinarias, y comparativo con periodo anterior. Usar las clasificaciones avanzadas de la Fase 1 (`clasificacion_resultado`, `subclasificacion_resultado`, `es_financiera`, `es_extraordinaria`, `afecta_ebitda`, `es_partida_no_monetaria`) como fuente primaria, con fallback a `expense_category` + heuristicas.

---

## Cambios detallados

### 1. `src/components/reports/IncomeStatementReport.tsx` (reescritura completa)

**Nueva interface de datos:**

```typescript
interface ProfessionalIncomeStatement {
  // 1. INGRESOS OPERATIVOS
  ingresosOperativos: AccountDetail[];       // clasificacion_resultado = 'ingreso_operativo'
  devoluciones: AccountDetail[];             // subclasificacion = 'devoluciones'
  ingresosNetos: number;
  otrosIngresosOperativos: AccountDetail[];   // subclasificacion = 'otros_ingresos_operativos'
  totalIngresosOperativos: number;

  // 2. COSTO DE VENTAS
  costoVentas: AccountDetail[];              // clasificacion_resultado = 'costo_ventas'
  totalCostoVentas: number;

  // UTILIDAD BRUTA
  utilidadBruta: number;
  margenBruto: number;

  // 3. GASTOS OPERATIVOS (sin D&A)
  gastosOperativos: AccountDetail[];         // clasificacion_resultado = 'gasto_operativo'
  depreciacionAmortizacion: AccountDetail[]; // es_partida_no_monetaria = true dentro de operativos
  totalGastosOperativosSinDA: number;
  totalDA: number;
  totalGastosOperativos: number;

  // EBITDA
  ebitda: number;                            // Utilidad Bruta - Gastos Operativos (sin D&A)
  margenEbitda: number;

  // EBIT
  ebit: number;                              // Utilidad Bruta - Total Gastos Operativos (con D&A)
  margenOperativo: number;

  // 4. RESULTADO FINANCIERO
  ingresosFinancieros: AccountDetail[];      // ingreso_no_operativo + es_financiera
  gastosFinancieros: AccountDetail[];        // gasto_no_operativo + es_financiera
  resultadoFinanciero: number;

  // EBT
  ebt: number;                               // EBIT +/- Resultado Financiero

  // 5. PARTIDAS EXTRAORDINARIAS
  extraordinarios: AccountDetail[];           // es_extraordinaria = true
  totalExtraordinarios: number;

  // UTILIDAD ANTES DE IMPUESTOS
  utilidadAntesImpuestos: number;

  // IMPUESTO
  impuesto: number;
  tasaImpuesto: number;
  taxEnabled: boolean;

  // UTILIDAD NETA
  utilidadNeta: number;
  margenNeto: number;
}
```

**Nueva logica de clasificacion** (reemplaza `classifyExpense`):

Usa `clasificacion_resultado` como fuente primaria. Si es null, aplica fallback con `expense_category` y luego heuristicas por nombre. Para separar D&A de operativos, filtra por `es_partida_no_monetaria === true` o `subclasificacion_resultado` en ('depreciacion', 'amortizacion'). Para financieros, filtra por `es_financiera === true`.

**Comparativo con periodo anterior:**

Se calcula el mismo `ProfessionalIncomeStatement` para el periodo inmediatamente anterior (Q anterior o ano anterior). Se muestra como columna adicional en la tabla con variacion absoluta y porcentual.

**Calculo de EBITDA (formula obligatoria):**
```
EBITDA = Utilidad Bruta - (Total Gastos Operativos - Depreciacion - Amortizacion)
```

Esto excluye automaticamente gastos financieros, impuestos y extraordinarios porque esos estan en secciones separadas.

**UI actualizada:**

La tabla tendra las siguientes secciones con colores diferenciados:

| Seccion | Color fondo |
|---------|-------------|
| 1. Ingresos Operativos | Verde |
| 2. Costo de Ventas | Naranja |
| UTILIDAD BRUTA | Azul (destacado) |
| 3. Gastos Operativos | Purpura |
| -- Depreciacion y Amortizacion | Purpura claro |
| EBITDA | Cyan (destacado, nuevo) |
| EBIT | Azul (destacado) |
| 4. Resultado Financiero | Slate |
| EBT | Amber (destacado) |
| 5. Extraordinarios | Gris (si existen) |
| Impuesto | -- |
| UTILIDAD NETA | Fondo muted (final) |

Columnas de la tabla:
- Codigo | Concepto | Periodo Actual | Periodo Anterior | Variacion

Las columnas de comparativo se muestran solo si hay datos del periodo anterior.

**Cards de margenes** (parte inferior):
- Margen Bruto (%)
- Margen EBITDA (%) -- nuevo
- Margen Operativo (EBIT) (%)
- Margen Neto (%)

### 2. `src/services/pdfService.ts` (actualizar seccion Income Statement)

**Nueva interface `NIIFIncomeStatementData`:**

Extender para incluir: `ebitda`, `margenEbitda`, `ingresosFinancieros`, `gastosFinancieros`, `resultadoFinanciero`, `ebt`, `extraordinarios`, `totalExtraordinarios`, `depreciacionAmortizacion`, `totalDA`, y opcionalmente datos del `periodoAnterior`.

**Actualizar `exportIncomeStatementNIIFToPDF`:**

Agregar filas para:
- Seccion EBITDA entre Utilidad Bruta y EBIT
- Seccion Resultado Financiero despues de EBIT
- Fila EBT
- Seccion Extraordinarios (si existen)
- Columnas comparativas si hay periodo anterior

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/reports/IncomeStatementReport.tsx` | Reescritura: nueva interface, logica de clasificacion avanzada, EBITDA/EBIT/EBT, resultado financiero, extraordinarios, comparativo |
| `src/services/pdfService.ts` | Actualizar NIIFIncomeStatementData y exportIncomeStatementNIIFToPDF |

No se necesitan cambios en base de datos (la Fase 1 ya agrego todos los campos necesarios).

---

## Formulas clave

```text
Ingresos Netos = Ingresos Operativos - Devoluciones
Total Ingresos Operativos = Ingresos Netos + Otros Ingresos Operativos
Utilidad Bruta = Total Ingresos Operativos - Total Costo de Ventas
EBITDA = Utilidad Bruta - (Gastos Operativos sin D&A)
EBIT = Utilidad Bruta - Total Gastos Operativos (con D&A)
Resultado Financiero = Ingresos Financieros - Gastos Financieros
EBT = EBIT + Resultado Financiero - Extraordinarios
Utilidad Neta = EBT - Impuesto
```

---

## Retrocompatibilidad

- Si `clasificacion_resultado` es null, se usa `expense_category` como fallback
- Si `expense_category` tambien es null, se aplican heuristicas por nombre (keywords)
- Los datos historicos se mapearon en la migracion de Fase 1
- No se eliminan campos antiguos

