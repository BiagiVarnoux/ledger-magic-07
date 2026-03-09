

# Plan: Kárdex FIFO por Lote

## Resumen
Agregar un módulo FIFO separado que convive con el CPP existente. Al cerrar un embarque se crearán lotes (`inventory_lots`) además de los movimientos. Un nuevo Kárdex FIFO permite ver lotes activos y registrar salidas consumiendo lotes por antigüedad.

## Archivos a crear

### 1. `src/components/inventory/fifo-utils.ts`
Utilidades puras (sin Supabase):
- `InventoryLot` interface
- `FifoProductState` interface con saldo_total, saldo_valorado, costo_promedio_fifo, lotes_activos, costo_siguiente_salida
- `FifoSalidaLine` interface (lot, cantidad, costo_total)
- `calcularEstadoFifo(lots)` — filtra lotes con stock > 0, calcula totales
- `simularSalidaFifo(lots, cantidad)` — consume lotes del más antiguo al más nuevo, lanza error si stock insuficiente

### 2. `src/components/inventory/FifoExitModal.tsx`
Dialog para registrar salida FIFO:
- Campos: fecha, cantidad, referencia
- Preview en tiempo real: tabla mostrando qué lotes se consumirán (usando `simularSalidaFifo`)
- Al guardar: para cada línea, actualiza `cantidad_disponible` del lote e inserta `inventory_movement` con `metodo_valuacion: 'FIFO'` y `inventory_lot_id`

### 3. `src/components/inventory/FifoKardexModal.tsx`
Dialog con Kárdex FIFO completo:
- Carga lotes y movimientos FIFO del producto desde Supabase
- 4 cards resumen (saldo, valor, lotes activos, próximo costo salida)
- Botón "Registrar Salida FIFO" (si no es readOnly y hay stock)
- Tab "Lotes": tabla con fecha, C.U., inicial, disponible, consumido, estado (badge verde/gris)
- Tab "Movimientos": movimientos FIFO con referencia al lote

## Archivos a modificar

### 4. `src/pages/inventory/Index.tsx`
- Agregar estado `fifoProduct` y modal `FifoKardexModal`
- Reemplazar botón único "Kárdex" por dos botones: "CPP" y "FIFO"
- Imports: `Layers` de lucide, `FifoKardexModal`

### 5. `src/pages/shipments/Index.tsx`
- En `handleConfirmClose`, sección "3. Insert inventory movements" (líneas 317-334):
  - Antes de insertar el movimiento, crear un `inventory_lot` con `cantidad_inicial` y `cantidad_disponible` = cantidad del producto
  - Vincular el movimiento al lote creado (`inventory_lot_id: newLot.id`)
  - Cambiar `metodo_valuacion` de `'CPP'` a `'FIFO'`

## Archivos que NO se tocan
- `inventory-utils.ts`, `ProductKardexModal.tsx`, `ManualMovementModal.tsx`, `InventoryExitModal.tsx`, `ShipmentCloseModal.tsx`
- Todo `src/accounting/` y `src/components/kardex/`

## Sin cambios de base de datos
Las tablas `inventory_lots` e `inventory_movements` ya existen con los campos necesarios.

