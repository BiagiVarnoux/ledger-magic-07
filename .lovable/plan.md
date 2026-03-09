

# Plan: Completar Backup/Restauración con datos faltantes

## Diagnóstico

El backup actual **NO incluye** las siguientes tablas de Supabase:
- `products` (inventario)
- `inventory_movements` (movimientos de inventario)
- `inventory_lots` (lotes de inventario)
- `import_lots` (lotes de importación)
- `cost_sheets` y `cost_sheet_cells` (hojas de costo)
- `report_settings` (configuración de reportes)

Los **embarques** están en `localStorage` (no en Supabase), así que también deben incluirse en el backup.

## Cambios en `src/services/backupService.ts`

### 1. Ampliar `BackupData` interface
Agregar campos opcionales para mantener compatibilidad con backups antiguos:
- `products?: any[]`
- `inventory_movements?: any[]`
- `inventory_lots?: any[]`
- `import_lots?: any[]`
- `cost_sheets?: any[]`
- `cost_sheet_cells?: any[]`
- `report_settings?: any[]`
- `shipments?: any[]` (desde localStorage)

### 2. `createFullBackup()`
- Agregar queries para las 7 tablas faltantes en el `Promise.all`
- Incluir `ShipmentStorage.load()` para embarques
- Incrementar versión a `'2.0'`

### 3. `restoreFromBackup()`
- Agregar eliminación de las tablas nuevas (en orden correcto de dependencias: cells antes de sheets, movements/lots antes de products)
- Agregar inserción condicional para cada tabla nueva
- Restaurar embarques en localStorage con `ShipmentStorage.save()`

### 4. `validateBackupFile()`
Sin cambios — ya acepta campos extra y solo valida los 3 campos obligatorios originales.

### 5. `BackupRestoreModal.tsx`
- Actualizar `formatBackupStats()` para mostrar conteos de productos, movimientos de inventario y embarques en el resumen de restauración.

