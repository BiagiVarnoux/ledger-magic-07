
# Análisis: Problemas en Sistema de Inventarios

Después de revisar el código, he identificado las causas raíz de los 3 problemas reportados y el plan de solución:

## Problema 1: CPP con costo 0,00 en salidas

**Causa**: En `InventoryExitModal.tsx`, el método `calcularEstadoProducto()` no recibe el parámetro `untilDate` correctamente y cuando calcula el `costoUnitario` para la salida, devuelve 0 porque no encuentra el estado actual del producto.

**Ubicación**: `src/components/inventory/InventoryExitModal.tsx` línea ~97
```typescript
costoUnitario: calcularEstadoProducto(allMovements).costoUnitario || 0,
```

**Solución**: Pasar los movimientos filtrados hasta la fecha del asiento y asegurar que el cálculo CPP sea correcto.

## Problema 2: FIFO no actualiza lotes

**Causa**: El `InventoryExitModal` siempre usa método `CPP` y no tiene lógica para detectar cuando debe usar FIFO. Necesita detectar si el producto tiene configuración FIFO y usar `FifoExitModal` en su lugar.

**Ubicación**: `src/pages/journal/Index.tsx` línea ~168 donde detecta costo de ventas
```typescript
// Actualmente siempre usa InventoryExitModal
setInventoryExitModal({ 
  isOpen: true, 
  journalEntryId: savedEntry.id,
  journalDate: savedEntry.date,
  costLines,
});
```

**Solución**: Añadir lógica de detección del método de valuación del producto (CPP vs FIFO) y abrir el modal correspondiente.

## Problema 3: Modal no llena monto automáticamente

**Causa**: Después de registrar las salidas de inventario, el sistema no actualiza el monto del asiento contable con el costo total calculado.

**Ubicación**: El flujo `InventoryExitModal.onSave()` en `src/pages/journal/Index.tsx` no tiene callback para actualizar los montos del formulario.

**Solución**: Modificar el modal para retornar el costo total calculado y actualizar automáticamente el monto en la línea de Costo de Ventas.

## Plan de Implementación

### 1. Arreglar cálculo CPP en InventoryExitModal
- Corregir el cálculo del `costoUnitario` filtrando movimientos hasta la fecha del asiento
- Asegurar que `calcularEstadoProducto()` recibe los datos correctos

### 2. Implementar detección de método de valuación
- Modificar detección de costo de ventas en `src/pages/journal/Index.tsx`
- Consultar la configuración del producto para decidir CPP vs FIFO
- Abrir `FifoExitModal` cuando corresponde FIFO

### 3. Auto-completar montos en asiento contable
- Modificar callback `onSave` de ambos modales de salida
- Retornar costo total calculado al componente padre
- Actualizar automáticamente el monto en la línea contable correspondiente

### 4. Arreglar lógica FIFO en FifoExitModal
- Verificar que actualice correctamente `inventory_lots.cantidad_disponible`
- Asegurar que cree `inventory_movements` con `inventory_lot_id` y `metodo_valuacion: 'FIFO'`

## Archivos a Modificar:
1. `src/components/inventory/InventoryExitModal.tsx` - Corregir cálculo CPP
2. `src/components/inventory/FifoExitModal.tsx` - Verificar lógica FIFO
3. `src/pages/journal/Index.tsx` - Detección de método + auto-completar montos
4. `src/components/inventory/inventory-utils.ts` - Posibles mejoras en utilidades

## Consideraciones Técnicas:
- Mantener retrocompatibilidad con asientos existentes
- Validar que los cálculos CPP y FIFO sean consistentes
- Asegurar que el UX sea fluido (modal → cálculo → actualización automática)
- Evitar duplicación de lógica entre CPP y FIFO
