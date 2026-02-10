
## Plan: Corregir Asientos Descuadrados y Prevenir Futuros Errores

### Parte 1: Corregir los 2 asientos existentes

Se ajustará la línea de mayor importe Debe en cada asiento, sumándole 0,01 para igualar Debe = Haber.

**Correcciones SQL a ejecutar:**

| Asiento | Línea ID | Acción | Valor actual → Nuevo |
|---------|----------|--------|---------------------|
| 153-Q4-25 | 735 | +0,01 al Debe | 1.282,60 → 1.282,61 |
| 154-Q4-25 | 753 | +0,01 al Debe | 21.885,78 → 21.885,79 |

```sql
-- Corregir asiento 153-Q4-25 (línea 735)
UPDATE journal_lines SET debit = 1282.61 WHERE id = 735;

-- Corregir asiento 154-Q4-25 (línea 753)
UPDATE journal_lines SET debit = 21885.79 WHERE id = 753;
```

---

### Parte 2: Agregar redondeo final al calcular saldos de cuentas

**Archivo**: `src/components/reports/BalanceSheetReport.tsx`

Actualmente el saldo se acumula así:
```typescript
for (const l of e.lines) {
  if (l.account_id !== a.id) continue;
  bal += signedBalanceFor(l.debit, l.credit, a.normal_side);
}
// ... luego se asigna:
if (acc) acc.balance = bal;  // ← Sin redondeo final
```

**Cambiar a:**
```typescript
if (acc) acc.balance = round2(bal);  // ← Con redondeo de seguridad
```

Esto se aplica en:
- Línea ~140: `if (acc) acc.balance = round2(bal);`
- Línea ~145: `if (acc) acc.balance = round2(bal);`
- Línea ~149: `if (acc) acc.balance = round2(bal);`

---

### Parte 3: Agregar indicador visual de asientos descuadrados

**Archivo**: `src/components/journal/JournalEntriesTable.tsx`

Agregar lógica para detectar asientos descuadrados y mostrar un indicador:

```typescript
const entryDiff = entry.lines.reduce((sum, l) => sum + l.debit - l.credit, 0);
const isUnbalanced = Math.abs(round2(entryDiff)) >= 0.01;
```

Mostrar un ícono o badge rojo cuando `isUnbalanced === true`.

---

### Resumen de cambios

| Tipo | Archivo / Ubicación | Acción |
|------|---------------------|--------|
| **Datos** | Base de datos | UPDATE 2 líneas (id 735 y 753) |
| **Código** | `BalanceSheetReport.tsx` | Aplicar `round2()` al asignar `acc.balance` |
| **Código** | `JournalEntriesTable.tsx` | Mostrar indicador de descuadre |

---

### Resultado esperado

- Balance General: Activos = Pasivo + Patrimonio (diferencia = 0,00 ✓)
- Los 2 asientos corregidos cuadrarán perfectamente
- Futuras acumulaciones de saldos estarán protegidas contra errores de punto flotante
- El usuario podrá ver inmediatamente si algún asiento está descuadrado
