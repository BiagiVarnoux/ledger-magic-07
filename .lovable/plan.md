

## Plan: Filtro mensual + Migas de pan con memoria de estado

### Parte 1 — Filtro por mes (además de trimestre/anual)

**Alcance**: Libro Diario, Libros Auxiliares, Libro Mayor, y los 5 reportes (Balance Comprobación, Estado Resultados, Balance General, Flujo de Caja, Cambios Patrimonio).

**Diseño del selector unificado** (`PeriodSelector` ampliado):
- Tabs con 3 opciones: **Mensual** | **Trimestral** | **Anual**.
- Cuando se elige Mensual: dropdown con todos los meses desde 2020 hasta el mes actual, formato `Enero 2026`, `Febrero 2026`, etc. (más reciente primero).
- Cuando se elige Trimestral: dropdown actual `Q1 2026`, `Q2 2026`...
- Cuando se elige Anual: dropdown `Año 2026`...
- Muestra siempre la franja "Del YYYY-MM-DD al YYYY-MM-DD" debajo.

**Nuevas utilidades** (`src/accounting/quarterly-utils.ts` o nuevo `period-utils.ts`):
- `interface MonthPeriod { year, month, label, startDate, endDate }`.
- `getCurrentMonth()`, `getAllMonthsFromStart(2020)`, `parseMonthString()`, `isDateInMonth()`.
- `type PeriodType = 'monthly' | 'quarterly' | 'annual'`.
- `isDateInPeriod(date, periodType, periodValue)` helper unificado.

**Reemplazos por página**:
- **Libro Diario** (`src/pages/journal/Index.tsx`): reemplazar el `Select` de trimestre por `PeriodSelector` con las 3 opciones; ajustar `filteredEntries` para usar `isDateInPeriod`.
- **Libro Mayor** (`src/pages/ledger/Index.tsx`): igual; el "saldo inicial" se calcula como saldo acumulado hasta `period.startDate - 1`.
- **Libros Auxiliares** (`src/pages/auxiliary-ledgers/Index.tsx`): cambiar `selectedQuarter: Quarter` a un objeto período genérico; toda la lógica de balance/cierre usa `period.startDate`/`period.endDate` (ya parametrizada así internamente).
- **Reportes** (`src/pages/reports/Index.tsx`): elevar `periodType` + valor seleccionado al nivel de la página (compartido entre tabs); actualizar `TrialBalanceReport` para usar `PeriodSelector` (hoy usa `QuarterSelector`); los otros 3 ya usan `PeriodSelector`, solo añadirles la opción mensual.

### Parte 2 — Migas de pan con memoria de filtros

**Problema actual**: Al navegar entre páginas, los filtros (trimestre/mes seleccionado, cuenta del mayor, definición auxiliar, orden, etc.) se reinician.

**Solución**: Persistir estado de filtros por página en `sessionStorage` + agregar componente `Breadcrumbs` en `AppShell`.

**Diseño de migas de pan** (componente nuevo `src/components/layout/Breadcrumbs.tsx`):
Aparece debajo del header en `AppShell`, contextual a la ruta. Ideas:

1. **Ruta jerárquica básica**: `Inicio › Libro Diario › Q2 2026` (clickeable, regresa a la sección con el período mantenido).
2. **Historial de navegación reciente** (últimas 3-5 páginas visitadas): chips clickeables tipo `Reportes › Libros Auxiliares › Libro Diario` mostrando dónde estuviste, con sus filtros guardados.
3. **Indicador de período activo**: muestra el período seleccionado como chip removible al lado de la sección actual (`Libro Diario · Abril 2026 ✕`); clic en ✕ vuelve al período por defecto (mes/trimestre actual).
4. **Botón "Volver al estado anterior"**: flecha `‹` que restaura los filtros previos de esa misma página (útil si exploras y quieres volver).
5. **Acciones rápidas contextuales**: al final de la miga, mini-botones `Exportar` / `Filtros` según la página.

**Persistencia de estado** (`src/hooks/usePersistedState.ts`):
- Hook genérico `usePersistedState(key, defaultValue)` que sincroniza con `sessionStorage`.
- Aplicar a: `selectedQuarter/Period` en cada página, `ledgerAccount`, `selectedDefinitionId`, `sortOrder`, `filters` del libro diario.
- Clave por página: `journal:period`, `ledger:period`, `ledger:account`, `auxiliary:period`, `auxiliary:definition`, `reports:period`, `reports:tab`.

**Historial de navegación** (`src/contexts/NavigationHistoryContext.tsx`):
- Provider que escucha `useLocation` y mantiene array de las últimas 5 rutas visitadas + timestamp.
- Expone `useNavigationHistory()` para que `Breadcrumbs` lo lea.

### Archivos a crear / modificar

**Crear**:
- `src/accounting/period-utils.ts` (utilidades unificadas mes/trimestre/año + `isDateInPeriod`).
- `src/components/layout/Breadcrumbs.tsx`.
- `src/contexts/NavigationHistoryContext.tsx`.
- `src/hooks/usePersistedState.ts`.

**Modificar**:
- `src/components/reports/PeriodSelector.tsx` (añadir opción mensual).
- `src/components/reports/TrialBalanceReport.tsx` (migrar a `PeriodSelector`).
- `src/components/reports/IncomeStatementReport.tsx`, `CashFlowReport.tsx`, `EquityChangesReport.tsx` (añadir mensual).
- `src/pages/journal/Index.tsx`, `src/pages/ledger/Index.tsx`, `src/pages/auxiliary-ledgers/Index.tsx`, `src/pages/reports/Index.tsx` (usar `PeriodSelector` + `usePersistedState`).
- `src/components/layout/AppShell.tsx` (incluir `Breadcrumbs` y envolver con `NavigationHistoryProvider`).
- `src/App.tsx` (registrar el provider de historial).

### Pregunta para confirmar antes de implementar

Para las migas de pan, ¿prefieres que implemente **todas las ideas (1-5)** o solo un subconjunto? Mi recomendación mínima viable sería **1 + 3 + 4** (jerárquica con período activo + botón volver), dejando el historial de navegación reciente (idea 2) como mejora opcional posterior.

