

# Fix: Shipment Close Errors

## Root Cause Analysis

Two database constraint violations:

1. **`inventory_movements_tipo_check`**: The constraint requires lowercase values `'entrada'` or `'salida'`, but the code inserts `'ENTRADA'` and `'SALIDA'` (uppercase).

2. **`products_user_id_codigo_key`**: When closing a shipment with "new product" links, the code always does an `INSERT`. If a product with the same `codigo` + `user_id` already exists (e.g., from a previous failed attempt or re-close), it violates the unique constraint.

## Changes

### 1. `src/pages/shipments/Index.tsx` — Fix `tipo` case (line ~354)
- Change `tipo: 'ENTRADA'` to `tipo: 'entrada'`

### 2. `src/pages/shipments/Index.tsx` — Handle duplicate product codes (lines ~217-229)
- Before inserting a new product, first check if a product with the same `codigo` and `user_id` already exists
- If it exists, use the existing product's ID instead of inserting a duplicate

### 3. `src/components/inventory/FifoExitModal.tsx` — Fix `tipo` case (line ~60)
- Change `tipo: 'SALIDA'` to `tipo: 'salida'`

### 4. `src/components/inventory/InventoryExitModal.tsx` — Fix `tipo` case (line ~97)
- Change `tipo: 'SALIDA'` to `tipo: 'salida'`

**Note**: The `InventoryExitModal.tsx` is listed as "do not touch" in the FIFO spec, but it has the same uppercase bug that will break CPP exits too. It needs fixing.

