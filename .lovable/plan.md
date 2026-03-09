

# Plan Actualizado: Sistema de Cierre de Clientes Auxiliares

## Resumen de Cambios

Incorporo las 4 correcciones señaladas:

1. **Fecha de cierre real**: Usar `todayISO()` en lugar del fin del trimestre
2. **Visibilidad en trimestres anteriores**: Los clientes cerrados siguen apareciendo en trimestres previos al cierre
3. **Reapertura automática completa**: Incluir reapertura en movimientos manuales (`handleAddManualMovement`)
4. **Botón de reapertura manual**: Agregar opción para reabrir clientes cerrados sin crear movimientos

## Cambios en Base de Datos

**Nueva migración SQL:**
```sql
ALTER TABLE auxiliary_ledger 
ADD COLUMN closed_date date NULL;

CREATE INDEX idx_auxiliary_ledger_closed_date 
ON auxiliary_ledger(closed_date);

COMMENT ON COLUMN auxiliary_ledger.closed_date IS 
'Fecha real en que se cerró el cliente (no trimestre). Null = activo';
```

## Lógica de Filtrado Actualizada

### Reglas de Visualización por Trimestre

Un cliente auxiliar aparece en un trimestre si:

**a) Cliente Activo (sin `closed_date`):**
- Tiene saldo ≠ 0 al fin del trimestre, O
- Tuvo movimientos dentro del trimestre

**b) Cliente Cerrado (con `closed_date`):**
- **Trimestre anterior al cierre**: Aparece si tiene saldo ≠ 0 o movimientos (normal)
- **Trimestre del cierre**: Aparece en sección colapsable "Cuentas Cerradas"
- **Trimestres futuros**: NO aparece en ninguna lista

### Cálculo de Trimestre de Cierre

```typescript
// Determinar en qué trimestre cayó el cierre
function getQuarterForDate(date: string): Quarter {
  // Usar getAllQuartersFromStart para encontrar el trimestre que contiene date
  // donde date >= quarter.startDate && date <= quarter.endDate
}

const closureQuarter = getQuarterForDate(entry.closed_date);
const isClosedInCurrentQuarter = 
  selectedQuarter.label === closureQuarter.label;
const isClosedInFutureQuarter = 
  selectedQuarter.startDate > entry.closed_date;
```

## Actualización de Archivos

### 1. `src/accounting/types.ts`

```typescript
export interface AuxiliaryLedgerEntry {
  id: string;
  client_name: string;
  account_id: string;
  definition_id?: string;
  total_balance: number;
  closed_date?: string; // YYYY-MM-DD - fecha real de cierre
}
```

### 2. `src/accounting/data-adapter.ts`

**Extender interfaz:**
```typescript
export interface IUserDataAdapter {
  // ... métodos existentes ...
  closeAuxiliaryEntry(id: string, closureDate: string): Promise<void>;
  reopenAuxiliaryEntry(id: string): Promise<void>;
}
```

**LocalAdapter:**
```typescript
closeAuxiliaryEntry: async (id, closureDate) => {
  const entries = await loadAuxiliaryEntries();
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.closed_date = closureDate;
    localStorage.setItem(STORAGE_KEY_AUXILIARY, JSON.stringify(entries));
  }
},

reopenAuxiliaryEntry: async (id) => {
  const entries = await loadAuxiliaryEntries();
  const entry = entries.find(e => e.id === id);
  if (entry) {
    delete entry.closed_date; // o entry.closed_date = undefined
    localStorage.setItem(STORAGE_KEY_AUXILIARY, JSON.stringify(entries));
  }
}
```

**SupaAdapter:**
```typescript
closeAuxiliaryEntry: async (id, closureDate) => {
  const { error } = await supabase
    .from('auxiliary_ledger')
    .update({ closed_date: closureDate })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
},

reopenAuxiliaryEntry: async (id) => {
  const { error } = await supabase
    .from('auxiliary_ledger')
    .update({ closed_date: null })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
```

**Reapertura automática en `upsertAuxiliaryMovementDetails`:**
```typescript
// Después de insertar movimientos, verificar clientes cerrados
const affectedClientIds = Array.from(new Set(details.map(d => d.aux_entry_id)));

for (const auxId of affectedClientIds) {
  const entry = await loadAuxiliaryEntry(auxId); // helper interno
  if (entry?.closed_date) {
    await reopenAuxiliaryEntry(auxId);
    console.log(`Cliente ${entry.client_name} reabierto automáticamente`);
  }
}
```

### 3. `src/pages/auxiliary-ledgers/Index.tsx`

**Estado adicional:**
```typescript
const [showClosedClients, setShowClosedClients] = useState(false);
```

**Helpers para clasificación:**
```typescript
// Determinar trimestre de cierre
const getQuarterForDate = (date: string): Quarter | null => {
  return availableQuarters.find(q => 
    date >= q.startDate && date <= q.endDate
  ) || null;
};
```

**Lógica de filtrado (reemplazar `filteredEntries` actual en líneas 82-124):**

```typescript
const { activeEntries, closedEntries } = useMemo(() => {
  if (!selectedDefinitionId || !selectedDefinition) {
    return { activeEntries: [], closedEntries: [] };
  }

  const baseEntries = auxiliaryEntries.filter(entry =>
    entry.definition_id === selectedDefinitionId || 
    entry.account_id === selectedDefinition.account_id
  );

  const active: typeof baseEntries = [];
  const closed: typeof baseEntries = [];

  baseEntries.forEach(entry => {
    const movements = clientMovements[entry.id];
    if (!movements) {
      // Aún no cargado, mostrar como activo
      active.push({ ...entry, _movementsLoaded: false });
      return;
    }

    const quarterEnd = selectedQuarter.endDate;
    const quarterStart = selectedQuarter.startDate;

    const quarterBalance = round2(
      movements
        .filter(m => m.movement_date <= quarterEnd)
        .reduce((sum, m) => 
          sum + (m.movement_type === 'INCREASE' ? m.amount : -m.amount), 0
        )
    );

    const hasMovementsInQuarter = movements.some(
      m => m.movement_date >= quarterStart && m.movement_date <= quarterEnd
    );

    const enrichedEntry = {
      ...entry,
      total_balance: quarterBalance,
      _hasMovementsInQuarter: hasMovementsInQuarter,
      _movementsLoaded: true,
    };

    // Clasificación según estado de cierre
    if (!entry.closed_date) {
      // Cliente activo: mostrar si tiene saldo o movimientos
      if (hasMovementsInQuarter || Math.abs(quarterBalance) >= 0.01) {
        active.push(enrichedEntry);
      }
    } else {
      // Cliente cerrado
      const closureQuarter = getQuarterForDate(entry.closed_date);
      
      if (!closureQuarter) {
        // Fecha inválida, tratar como activo
        active.push(enrichedEntry);
        return;
      }

      const isClosedInCurrentQuarter = 
        selectedQuarter.label === closureQuarter.label;
      const isClosedInFutureQuarter = 
        selectedQuarter.startDate > entry.closed_date;

      if (isClosedInFutureQuarter) {
        // Trimestre posterior al cierre: NO mostrar
        return;
      }

      if (isClosedInCurrentQuarter) {
        // Trimestre del cierre: sección "Cuentas Cerradas"
        closed.push(enrichedEntry);
      } else {
        // Trimestre anterior al cierre: mostrar como activo histórico
        if (hasMovementsInQuarter || Math.abs(quarterBalance) >= 0.01) {
          active.push(enrichedEntry);
        }
      }
    }
  });

  return { activeEntries: active, closedEntries: closed };
}, [
  auxiliaryEntries, 
  selectedDefinitionId, 
  selectedDefinition, 
  selectedQuarter, 
  clientMovements,
  availableQuarters
]);
```

**Handler de cierre (nuevo):**
```typescript
const handleCloseClient = async (entry: AuxiliaryLedgerEntry) => {
  if (isReadOnly) {
    toast.error('No tienes permisos para cerrar clientes');
    return;
  }
  
  if (Math.abs(entry.total_balance) >= 0.01) {
    toast.error('Solo puedes cerrar clientes con saldo exactamente 0');
    return;
  }
  
  if (!confirm(
    `¿Cerrar el cliente "${entry.client_name}"?\n\n` +
    `Se archivará a partir de hoy y no aparecerá en registros futuros.\n` +
    `Puedes reabrirlo manualmente si lo necesitas.`
  )) {
    return;
  }
  
  try {
    await adapter.closeAuxiliaryEntry(entry.id, todayISO());
    const updatedEntries = await adapter.loadAuxiliaryEntries();
    setAuxiliaryEntries(updatedEntries);
    toast.success(`Cliente "${entry.client_name}" cerrado exitosamente`);
  } catch (error: any) {
    toast.error(error.message || 'Error al cerrar el cliente');
  }
};
```

**Handler de reapertura manual (nuevo):**
```typescript
const handleReopenClient = async (entry: AuxiliaryLedgerEntry) => {
  if (isReadOnly) {
    toast.error('No tienes permisos para reabrir clientes');
    return;
  }
  
  if (!confirm(
    `¿Reabrir el cliente "${entry.client_name}"?\n\n` +
    `Volverá a estar activo y visible en todos los trimestres.`
  )) {
    return;
  }
  
  try {
    await adapter.reopenAuxiliaryEntry(entry.id);
    const updatedEntries = await adapter.loadAuxiliaryEntries();
    setAuxiliaryEntries(updatedEntries);
    toast.success(`Cliente "${entry.client_name}" reabierto exitosamente`);
  } catch (error: any) {
    toast.error(error.message || 'Error al reabrir el cliente');
  }
};
```

**Actualizar `handleAddManualMovement` (líneas 224-268) con reapertura automática:**

```typescript
const handleAddManualMovement = async () => {
  // ... validaciones existentes ...

  try {
    const movement: AuxiliaryMovementDetail = {
      id: crypto.randomUUID(),
      aux_entry_id: manualMovementData.client_id,
      journal_entry_id: 'MANUAL_ADJUSTMENT',
      movement_date: todayISO(),
      amount: amount,
      movement_type: manualMovementData.movement_type
    };

    await adapter.upsertAuxiliaryMovementDetails([movement]);

    // NUEVO: Verificar si el cliente estaba cerrado y reabrirlo
    const clientEntry = auxiliaryEntries.find(
      e => e.id === manualMovementData.client_id
    );
    if (clientEntry?.closed_date) {
      await adapter.reopenAuxiliaryEntry(clientEntry.id);
      toast.info(
        `Cliente "${clientEntry.client_name}" reabierto automáticamente`
      );
    }

    // ... reload existente ...
    toast.success('Movimiento agregado exitosamente');
    // ...
  } catch (error: any) {
    toast.error(error.message || 'Error al agregar movimiento');
  }
};
```

**UI - Botón de cierre en tabla de clientes activos (después de línea 577):**

```tsx
{/* En cada fila de activeEntries, después del botón Editar */}
{Math.abs(entry.total_balance) < 0.01 && !entry.closed_date && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleCloseClient(entry)}
    title="Cerrar cliente (saldo 0)"
  >
    <Lock className="w-4 h-4" />
  </Button>
)}
```

**UI - Sección colapsable "Cuentas Cerradas" (después de tabla principal):**

```tsx
{closedEntries.length > 0 && (
  <Card className="mt-6 border-muted">
    <Collapsible open={showClosedClients} onOpenChange={setShowClosedClients}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-4">
          {showClosedClients ? (
            <ChevronDown className="w-4 h-4 mr-2" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-2" />
          )}
          <Lock className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="font-medium">
            Cuentas Cerradas en {selectedQuarter.label}
          </span>
          <Badge variant="secondary" className="ml-2">
            {closedEntries.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Saldo Final</TableHead>
                <TableHead>Fecha Cierre</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedEntries.map(entry => (
                <TableRow key={entry.id} className="text-muted-foreground">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      {entry.client_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmt(entry.total_balance)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.closed_date || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {!isReadOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReopenClient(entry)}
                      >
                        Reabrir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>
)}
```

**Actualizar cálculo de `totalBalance` para incluir solo activos (línea 274):**

```typescript
const totalBalance = useMemo(() => {
  return activeEntries.reduce((sum, entry) => sum + entry.total_balance, 0);
}, [activeEntries]);
```

**Actualizar tabla principal para usar `activeEntries` (línea 565):**

```tsx
<TableBody>
  {activeEntries.map((entry) => (
    // ... renderizado existente ...
  ))}
  {/* Fila de totales */}
  <TableRow className="font-bold bg-muted/50">
    {/* ... */}
  </TableRow>
</TableBody>
```

### 4. `src/components/auxiliary-ledger/AuxiliaryLedgerModal.tsx`

**Actualizar `handleSave` (después de línea 186) con reapertura automática:**

```typescript
const handleSave = async () => {
  try {
    // ... guardar entry y movements ...
    
    if (movementDetails.length > 0) {
      await adapter.upsertAuxiliaryMovementDetails(movementDetails);
      
      // NUEVO: Verificar clientes cerrados y reabrirlos
      const uniqueClientIds = Array.from(
        new Set(movementDetails.map(md => md.aux_entry_id))
      );
      
      const closedClients: string[] = [];
      for (const clientId of uniqueClientIds) {
        const client = auxiliaryEntries.find(e => e.id === clientId);
        if (client?.closed_date) {
          await adapter.reopenAuxiliaryEntry(clientId);
          closedClients.push(client.client_name);
        }
      }
      
      if (closedClients.length > 0) {
        toast.info(
          `${closedClients.length} cliente(s) reabierto(s): ${closedClients.join(', ')}`
        );
      }
    }
    
    const updatedEntries = await adapter.loadAuxiliaryEntries();
    setAuxiliaryEntries(updatedEntries);
    onSave(originalEntry);
    toast.success('Asiento y movimientos auxiliares guardados');
    onClose();
  } catch (error: any) {
    toast.error(error.message || 'Error al guardar movimientos');
  }
};
```

**Excluir clientes cerrados del dropdown (líneas 56-69):**

```typescript
const allClientsForAccount = auxiliaryEntries.filter(
  entry => 
    entry.account_id === currentLine?.accountId && 
    !entry.closed_date  // NUEVA condición
);
```

## Flujo Completo Actualizado

### 1. Usuario Cierra un Cliente (8 de marzo)

```
Usuario hace clic en botón Lock
→ Validación: saldo debe ser 0
→ Confirmación: "¿Cerrar cliente?"
→ SE EJECUTA: adapter.closeAuxiliaryEntry(id, "2026-03-08")
→ Se guarda closed_date = "2026-03-08" (hoy, no fin de trimestre)
→ Cliente desaparece de la lista principal
→ Cliente aparece en "Cuentas Cerradas" del Q1 2026
```

### 2. Usuario Ve Trimestres

**Q4 2025 (anterior al cierre):**
- Cliente aparece normal si tuvo actividad
- Muestra saldo histórico

**Q1 2026 (trimestre del cierre):**
- Cliente NO aparece en lista principal
- Cliente SÍ aparece en sección colapsable "Cuentas Cerradas"
- Botón "Reabrir" disponible

**Q2 2026+ (posteriores):**
- Cliente NO aparece en ninguna lista

### 3. Registro de Nuevo Movimiento

**Desde Diario:**
```
Usuario asigna movimiento a cliente cerrado
→ Modal AuxiliaryLedgerModal no muestra cliente cerrado en dropdown
→ Si el cliente se reabrió antes, ya está disponible
```

**Desde Movimiento Manual:**
```
Usuario agrega movimiento manual a cliente cerrado
→ handleAddManualMovement detecta closed_date
→ SE EJECUTA: adapter.reopenAuxiliaryEntry(clientId)
→ Toast: "Cliente reabierto automáticamente"
→ Cliente vuelve a lista activa
```

### 4. Reapertura Manual

```
Usuario hace clic en "Reabrir" en sección cerrados
→ Confirmación: "¿Reabrir cliente?"
→ SE EJECUTA: adapter.reopenAuxiliaryEntry(id)
→ closed_date = null
→ Cliente vuelve a aparecer en lista principal
→ Toast: "Cliente reabierto exitosamente"
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| **Nueva migración SQL** | Columna `closed_date` + índice |
| `src/accounting/types.ts` | `closed_date?: string` en `AuxiliaryLedgerEntry` |
| `src/accounting/data-adapter.ts` | Métodos `closeAuxiliaryEntry`, `reopenAuxiliaryEntry`, reapertura automática |
| `src/pages/auxiliary-ledgers/Index.tsx` | Lógica de filtrado tri-partita, handlers, UI de cierre/reapertura, sección colapsable |
| `src/components/auxiliary-ledger/AuxiliaryLedgerModal.tsx` | Excluir cerrados, reapertura automática en `handleSave` |

## Iconos Usados (lucide-react)

- `Lock`: Cliente cerrado, botón cerrar
- `ChevronDown/ChevronRight`: Collapsible trigger
- Importar: `import { Lock, ChevronDown, ChevronRight } from 'lucide-react';`

