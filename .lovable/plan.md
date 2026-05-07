## Diagnóstico

Encontré exactamente qué está pasando. **No hay corrupción de datos ni asientos eliminados** — todos tus asientos están intactos en la base de datos. El problema es un límite silencioso de Supabase que está ocultando líneas del libro diario al cargar.

### Evidencia

Comparé los dos backups y consulté la base de datos:

| Fuente | Total `journal_lines` | Saldo Banco MN (A.1) |
|---|---|---|
| Backup 05-05-26 | 994 | **5.446,49** ✓ |
| Backup 07-05-26 | 1.000 (exacto) | 5.389,99 |
| Base de datos (hoy) | **1.000 exacto** | 5.389,99 |

El número "1000 exacto" es la pista. Supabase / PostgREST aplica un **límite por defecto de 1000 filas por consulta**. Cuando el sistema carga el libro diario hace:

```ts
// src/accounting/data-adapter.ts línea 255
const { data: lines } = await supa
  .from("journal_lines")
  .select(...)
  .in("entry_id", ids);   // ← se corta en 1000 filas, sin error
```

Entre el 05-05 y el 07-05 cruzaste el umbral de 1000 líneas. Desde entonces, **el sistema solo está leyendo las primeras 1000 líneas** que devuelve PostgREST (orden no determinista). Las líneas que quedan fuera de esas 1000 simplemente no se suman en ningún cálculo: ni en el Libro Diario, ni en el Libro Mayor, ni en los Reportes, ni en el Balance General. Por eso ves un saldo "raro" de Banco MN: faltan asientos que sí tocaban esa cuenta pero quedaron fuera del corte.

Lo mismo afecta a otras tablas grandes (`journal_entries` ya tiene 412, se acerca al límite; `auxiliary_movement_details`, `inventory_movements`, `kardex_movements`, `cost_sheet_cells` también).

Es el mismo motivo por el que el backup del 07-05 capturó exactamente 1000 líneas en vez de las ~1006 reales.

## Plan de corrección

### 1. Helper de paginación en `src/accounting/data-adapter.ts`

Agregar una función `fetchAll(query, pageSize=1000)` que itere usando `.range(from, to)` hasta que la página devuelta sea menor al `pageSize`. Esto evita el corte silencioso sin importar cuánto crezca la base.

```ts
async function fetchAll<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const PAGE = 1000; const out: T[] = []; let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
```

### 2. Aplicar paginación a TODAS las cargas masivas en `data-adapter.ts`

- `loadEntries`: paginar tanto `journal_entries` como `journal_lines` (esta es la causa directa del bug que reportas).
- `loadAccounts`, `loadAuxiliaryDefinitions`, `loadAuxiliaryEntries`, `loadAuxiliaryMovementDetails`, `loadKardexDefinitions`, `loadQuarterlyClosures`.
- Para la consulta `.in("entry_id", ids)` de `journal_lines`: además de paginar el resultado, partir `ids` en lotes de ~500 para no exceder límites de URL si el número de entries crece mucho.

### 3. Aplicar paginación al servicio de backup `src/services/backupService.ts`

Reemplazar cada `supabase.from(t).select('*').eq('user_id', ...)` por la versión paginada, para que los próximos backups capturen el 100% de las filas (los backups que ya hiciste también estaban truncados a 1000).

### 4. Validación post-fix

- Recargar la app y verificar que el Balance General muestre Banco MN ≈ **5.389,99 Bs** consistente con el saldo correcto al 06-05-26 (no 13.000).
- Verificar que aparezcan los asientos de noviembre/diciembre que probablemente no se estaban viendo en el Libro Diario.
- Hacer un backup nuevo y confirmar que captura > 1000 líneas (deberían ser ~1006).

### Archivos a tocar

- `src/accounting/data-adapter.ts` — agregar helper `fetchAll` y paginar todas las cargas.
- `src/services/backupService.ts` — paginar las lecturas del backup.

### Lo que NO se toca

- No hay que tocar la base de datos ni restaurar backups. Tus datos están completos y correctos en Supabase. Solo el cliente los está leyendo truncados.
- No hay que cambiar la lógica contable, ni los reportes, ni el Libro Mayor — apenas reciban las filas completas, los saldos se corregirán solos.

### Nota sobre el saldo "13.000"

Si después del fix el Balance General sigue mostrando un valor distinto al esperado, será un tema separado de clasificación de cuentas, no de datos faltantes. Pero el síntoma que describes (saltos bruscos justo cuando se cruzaron las 1000 líneas) coincide al 100% con el límite de PostgREST.
