
## Filtrado de Libros Auxiliares por Trimestre

### El Problema

En los libros auxiliares hay clientes/proveedores que ya saldaron su deuda (saldo = 0,00) en trimestres anteriores, pero siguen apareciendo en la vista actual porque no hay forma de filtrar por período. Por ejemplo: "Ronaldo Gutierrez" pagó en Q4-25, pero sigue apareciendo en Q1-26.

El usuario quiere que el libro auxiliar sea **consciente del trimestre**: si un cliente ya tenía saldo cero al final del trimestre anterior, que no aparezca en el siguiente, salvo que tenga nuevos movimientos.

---

### Solución: Selector de Trimestre + Filtrado Inteligente

La solución consiste en agregar un **selector de trimestre** a la página de Libros Auxiliares. Al elegir un trimestre, el sistema filtrará qué clientes deben aparecer y calculará sus saldos **solo hasta el final de ese trimestre**.

**Lógica de visualización:**

Un cliente aparece en el trimestre seleccionado si:
1. Tiene **algún movimiento dentro del trimestre** (sea de aumento o disminución), O
2. Tiene un **saldo distinto de cero al final del trimestre** (es decir, tiene movimientos acumulados anteriores que aún no se han saldado).

Si el saldo al final del trimestre es cero Y no tiene movimientos en ese trimestre, el cliente NO aparece (quedó saldado en un período anterior).

**Cálculo de saldo por trimestre:**

El saldo de cada cliente se calcula considerando solo los movimientos cuya `movement_date` sea menor o igual a la fecha de fin del trimestre seleccionado. Esto se hace en el frontend, sin necesidad de cambios en la base de datos.

---

### Cambios Técnicos

#### 1. `src/pages/auxiliary-ledgers/Index.tsx`

**Estado nuevo:**
```typescript
const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(getCurrentQuarter());
```

**Lógica de filtrado con trimestre** (reemplaza el `filteredEntries` actual):
```typescript
const filteredEntries = useMemo(() => {
  if (!selectedDefinitionId || !selectedDefinition) return [];
  
  const baseEntries = auxiliaryEntries.filter(entry => 
    entry.definition_id === selectedDefinitionId || 
    entry.account_id === selectedDefinition.account_id
  );
  
  // Para cada entrada, calcular saldo hasta el fin del trimestre
  // usando los movimientos ya cargados en clientMovements
  // y filtrar los que no tienen actividad relevante
  return baseEntries
    .map(entry => {
      // Calcular saldo hasta fin del trimestre usando movimientos ya cargados
      // Si no están cargados aún, usar total_balance (se actualizará al expandir)
      const movements = clientMovements[entry.id];
      if (!movements) return entry; // Sin movimientos cargados, mostrar con saldo actual
      
      const quarterEnd = selectedQuarter.endDate;
      const relevantMovements = movements.filter(m => m.movement_date <= quarterEnd);
      const quarterBalance = relevantMovements.reduce((sum, m) => 
        sum + (m.movement_type === 'INCREASE' ? m.amount : -m.amount), 0
      );
      const hasMovementsInQuarter = movements.some(m => 
        m.movement_date >= selectedQuarter.startDate && m.movement_date <= quarterEnd
      );
      
      return { ...entry, total_balance: round2(quarterBalance), hasMovementsInQuarter };
    })
    .filter(entry => {
      // Mostrar si tiene actividad en el trimestre O saldo pendiente al cierre
      const movements = clientMovements[entry.id];
      if (!movements) return true; // Aún no cargados: mostrar por defecto
      return entry.hasMovementsInQuarter || Math.abs(entry.total_balance) >= 0.01;
    });
}, [auxiliaryEntries, selectedDefinitionId, selectedDefinition, selectedQuarter, clientMovements]);
```

**Nuevo problema:** actualmente los movimientos se cargan solo al expandir un cliente. Para que el filtro funcione sin tener que expandir todos uno por uno, necesitamos **cargar todos los movimientos del libro auxiliar seleccionado al cambiar de definición o trimestre**.

**Cambio en la carga de movimientos:**
```typescript
// Al seleccionar un libro auxiliar, cargar TODOS los movimientos de sus clientes
useEffect(() => {
  const loadAllMovements = async () => {
    if (!selectedDefinitionId) return;
    const baseEntries = auxiliaryEntries.filter(entry => 
      entry.definition_id === selectedDefinitionId || 
      entry.account_id === selectedDefinition?.account_id
    );
    const ids = baseEntries.map(e => e.id);
    // Cargar en paralelo
    const results = await Promise.all(ids.map(id => adapter.loadAuxiliaryDetails(id)));
    const map: Record<string, AuxiliaryMovementDetail[]> = {};
    ids.forEach((id, i) => { map[id] = results[i]; });
    setClientMovements(map);
  };
  loadAllMovements();
}, [selectedDefinitionId, auxiliaryEntries]);
```

**UI nueva:** Añadir selector de trimestre junto al selector de libro auxiliar, usando el componente `QuarterSelector` ya existente o un `Select` con `getAllQuartersFromStart`.

**Columnas de la tabla:** Al filtrar por trimestre, mostrar una columna adicional que indique si tuvo movimiento en ese período (badge "Activo") vs si solo arrastra saldo ("Saldo anterior").

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/auxiliary-ledgers/Index.tsx` | Agregar selector de trimestre, lógica de filtrado temporal, carga anticipada de movimientos |

No se requieren cambios en base de datos ni en el adaptador, ya que los movimientos tienen fecha (`movement_date`) que permite el cálculo temporal en el frontend.

---

### Comportamiento Esperado

- **Q4 2025:** "Ronaldo Gutierrez" aparece (tuvo movimiento en Q4 y quedó en saldo 0 ese trimestre).
- **Q1 2026:** "Ronaldo Gutierrez" NO aparece (saldo 0 al cierre de Q4-25, sin movimientos en Q1-26).
- **Q1 2026:** "1 iPhone 14 Pro Max" SÍ aparece (tiene saldo pendiente de 3.647 que se arrastra).
- Si se selecciona "Todos los trimestres" (opción adicional), aparecen todos sin filtro.

---

### Resumen

- Sin cambios en base de datos.
- Solo 1 archivo a modificar: `src/pages/auxiliary-ledgers/Index.tsx`.
- Agrega selector de trimestre.
- Carga anticipada de movimientos al cambiar de libro auxiliar.
- Filtra clientes según actividad y saldo en el período elegido.
- El saldo mostrado refleja el estado al cierre del trimestre seleccionado.
