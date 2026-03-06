

# Plan: Modulo de Inventario (Kardex por Producto)

## Resumen

Crear el modulo de Inventario con UI completa usando las tablas existentes `products` e `inventory_movements`. Incluye navegacion, pagina principal con dos paneles, modales de kardex/producto/movimiento, y deteccion automatica de salidas desde el Libro Diario.

## Archivos a crear

### 1. `src/pages/inventory/Index.tsx` — Pagina principal
- Layout de dos paneles (grid col-4 / col-8)
- Panel izquierdo: cards de cuentas de inventario agrupadas por `cuenta_inventario_id`, con valor total calculado
- Panel derecho: tabla de productos de la cuenta seleccionada con saldo, CPP, valor total calculados en frontend
- Botones "Nuevo Producto" y "Ver Kardex"
- Carga datos de `products` e `inventory_movements` desde Supabase filtrado por `user_id`
- Funcion `calcularEstadoProducto()` segun algoritmo CPP especificado
- ReadOnlyBanner si aplica

### 2. `src/components/inventory/ProductKardexModal.tsx` — Modal Kardex por producto
- Dialog max-w-4xl con encabezado (nombre, codigo, categoria, cards de saldo/CPP/valor)
- Tabla de movimientos ordenados por fecha asc con columnas: Fecha, Concepto, Entradas, Salidas, Saldo, C.U., Saldo Valorado
- Filas coloreadas (verde entrada, rojo salida)
- Boton "Nuevo Movimiento Manual" que abre el formulario de movimiento

### 3. `src/components/inventory/NewProductModal.tsx` — Formulario nuevo producto
- Dialog con campos: nombre, codigo, categoria (select), cuenta contable (select de cuentas ACTIVO), descripcion, unidad de medida
- Insert en `products` via Supabase

### 4. `src/components/inventory/ManualMovementModal.tsx` — Formulario movimiento manual
- Dialog con campos: tipo (ENTRADA/SALIDA), fecha, concepto, cantidad, costo unitario (solo ENTRADA), referencia
- Calcula `costo_total` segun tipo
- Insert en `inventory_movements`

### 5. `src/components/inventory/InventoryExitModal.tsx` — Modal salida desde Libro Diario
- Se abre cuando un asiento tiene lineas con `clasificacion_resultado === 'costo_ventas'`
- Permite seleccionar producto(s) y cantidad(es) para registrar salidas
- Inserta movimientos tipo SALIDA con `journal_entry_id`

## Archivos a modificar

### 6. `src/components/layout/AppShell.tsx`
- Agregar `{ path: '/inventory', label: 'Inventario' }` entre Embarques y Configuracion en el menu del owner

### 7. `src/App.tsx`
- Agregar import de `InventoryPage` y ruta `{isOwner && <Route path="inventory" element={<InventoryPage />} />}`

### 8. `src/pages/journal/Index.tsx`
- En `handleFinalSave`, despues de guardar exitosamente, detectar lineas con cuentas `clasificacion_resultado === 'costo_ventas'`
- Si hay, abrir `InventoryExitModal` con las lineas detectadas
- Agregar state para el modal y el import del componente

## Logica de calculo CPP (reutilizada en varios componentes)

Extraer a `src/components/inventory/inventory-utils.ts`:
```typescript
export function calcularEstadoProducto(movements) {
  // Ordenar por fecha asc, created_at asc
  // Iterar: ENTRADA suma saldo+valorado, SALIDA calcula CPP y resta
  // Retorna { saldo, costoUnitario, saldoValorado, ultimaFecha }
}
```

## No se modifica
- Tablas de Supabase (ya existen)
- Kardex existente (kardex_definitions/entries/movements)
- AccountingProvider, data-adapter
- Modulo de Embarques

