

# Plan: Mejoras al Módulo de Embarques

## Cambio 1: Mover campo costo_bateria a MedidasTab

- Eliminar input de `costo_bateria` en `NewShipmentForm` (líneas ~452-459) y `ProductosTab` (~740-755)
- Mantener checkbox `tiene_bateria` sin cambios
- En `MedidasTab`: agregar columna "Batería (Bs)" al final, editable solo si `tiene_bateria=true`, mostrar badge 🔋 junto al nombre

## Cambio 2: Categorías dinámicas

**Tipos (`shipment-types.ts`):**
- Cambiar `ProductCategory` de union a `string`
- Renombrar `PRODUCT_CATEGORY_LABELS` → `DEFAULT_CATEGORY_LABELS`
- Agregar campo `custom_categories?: Record<string, string>` a `Shipment`

**Utilidades (`shipment-utils.ts`):**
```typescript
const CUSTOM_CATEGORIES_KEY = 'shipment_custom_categories_v1';

export function loadCustomCategories(): Record<string, string>
export function saveCustomCategory(slug: string, label: string): void
export function getAllCategories(): Record<string, string>
```

**UI (`Index.tsx`):**
- En `NewShipmentForm` y `ProductosTab`: reemplazar Select estático por dinámico con `getAllCategories()`
- Agregar opción `"__nueva__"` → "➕ Nueva categoría..."
- Dialog inline para crear categoría: campo nombre, generar slug automático, guardar y seleccionar
- Reemplazar todas las referencias `PRODUCT_CATEGORY_LABELS` → `getAllCategories()`
- Eliminar castings `as ProductCategory`

## Cambio 3: Asiento 4 dinámico

Se implementa dentro del Cambio 4 — el asiento de nacionalización usará `cuenta_inventario_id` de productos vinculados en Supabase en lugar del mapa hardcodeado.

## Cambio 4: Modal de cierre con vinculación a inventario

**Nuevo componente:** `src/components/inventory/ShipmentCloseModal.tsx`

**Interfaces:**
```typescript
interface ProductLink {
  shipmentProductId: string;
  productId: string;
  isNew: boolean;
  newProductData?: { nombre: string; codigo: string; cuenta_inventario_id: string };
}

interface JournalPreview {
  memo: string;
  lines: Array<{ account_id: string; debit: number; credit: number }>;
}
```

**Props:**
```typescript
{
  isOpen: boolean;
  shipment: Shipment;
  costos: Array<{ product: ShipmentProduct; costo_unitario: number }>;
  onConfirm: (links: ProductLink[], customMemos: string[]) => Promise<void>;
  onCancel: () => void;
}
```

**Estructura:**
- Dialog `max-w-4xl` con 2 tabs
- **Tab 1 "Vinculación"**: tabla de productos, Select para vincular/crear, campos inline para nuevos productos (nombre, código, cuenta ACTIVO)
- **Tab 2 "Previsualización"**: mostrar 4 asientos dinámicos, memos editables
- Botones: Cancelar, ← Volver, Siguiente →, ✓ Aprobar y Cerrar

**Lógica Tab 1:**
- Cargar productos activos de Supabase al abrir
- Auto-match por nombre (`toLowerCase().includes()`)
- Validar código y cuenta antes de permitir avance

**Lógica Tab 2:**
- Calcular asientos 1-3 (igual que ahora)
- **Asiento 4 dinámico**: agrupar por `cuenta_inventario_id` del producto vinculado
- Inputs para editar memos

**Modificar `Index.tsx`:**
1. Estado `closeConfirmState` para modal
2. `handleClose`: validar, calcular costos, abrir modal (eliminar generación de asientos)
3. `handleConfirmClose`: crear productos en Supabase, generar 4 asientos, insertar `inventory_movements`, cerrar embarque
4. Renderizar `<ShipmentCloseModal>` en JSX

**Flujo completo:**
```
Click "Cerrar" → Validaciones → Calcular costos → Abrir modal
  Tab 1: Vincular productos (auto-match o crear)
  Tab 2: Previsualizar 4 asientos, editar memos
Click "Aprobar" → Crear productos nuevos → Generar asientos → Insertar movimientos → Guardar CERRADO
```

