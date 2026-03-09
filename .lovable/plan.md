

# Plan: Eliminar embarques cerrados con doble confirmación

## Situación actual
- `handleDelete` (línea 110) usa un simple `confirm()` del navegador
- El botón de eliminar (línea 714) está oculto cuando `isClosed` (`!isReadOnly && !isClosed`)

## Cambios

### 1. Mostrar botón eliminar siempre (línea ~714)
Cambiar la condición de `!isReadOnly && !isClosed` a solo `!isReadOnly` para el botón de eliminar, manteniéndolo separado del bloque de avanzar/cerrar.

### 2. Doble confirmación con AlertDialog (línea ~110)
Reemplazar el `confirm()` nativo por un estado + `AlertDialog` con dos pasos:
- **Paso 1**: "¿Estás seguro de eliminar el embarque {numero}?" con botones Cancelar / Continuar
- **Paso 2**: "Esta acción es irreversible. Los asientos contables generados NO se eliminarán." con botones Cancelar / Eliminar definitivamente (variant destructive)

Para embarques no cerrados, solo se muestra un paso de confirmación (el primero).

### Archivos modificados
- `src/pages/shipments/Index.tsx`: agregar estado `deleteConfirm`, renderizar `AlertDialog` de dos pasos, y mostrar botón siempre que no sea readOnly.

