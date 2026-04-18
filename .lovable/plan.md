

## Plan: Deshacer transiciones de estado en Embarques

### Problema
En el embarque **EMB-2026-002** se presionó por error "Registrar Flete", que avanzó el estado de `EN_COMPRA` → `FLETE_PAGADO`. Actualmente no hay forma de retroceder. Lo mismo aplica a las otras transiciones intermedias.

### Buenas noticias
Las transiciones entre `EN_COMPRA → FLETE_PAGADO → EN_ADUANA → EN_ALMACEN` **solo cambian el campo `status`** del embarque — no generan asientos contables, lotes ni movimientos de inventario. Esos efectos solo ocurren en el paso final "Cerrar Embarque". Por eso, deshacer es seguro y reversible siempre que el embarque **no esté en estado `CERRADO`**.

### Diseño de la funcionalidad

1. **Botón "Retroceder estado"** junto al botón de avanzar, en `ShipmentDetail` (`src/pages/shipments/Index.tsx`).
   - Visible solo cuando `status` es `FLETE_PAGADO`, `EN_ADUANA` o `EN_ALMACEN` (no en `EN_COMPRA` ni `CERRADO`).
   - Ícono `ArrowLeft` + tooltip "Volver al estado anterior".
   - Estilo `outline` discreto para no competir visualmente con "Avanzar".

2. **Doble confirmación** mediante `AlertDialog` en dos pasos:
   - **Paso 1**: "¿Seguro que quieres retroceder el estado de `[Estado actual]` a `[Estado anterior]`? Los datos ingresados en este paso (ej. flete, aduana) **se conservan**, solo cambia el estado."
   - **Paso 2**: "Confirmación final: esta acción es reversible volviendo a avanzar, pero asegúrate de que es lo que quieres hacer."
   - Solo después de confirmar ambos pasos se ejecuta el cambio.

3. **Lógica `handleRevert(s)`**:
   - Calcula el estado anterior con el mismo array `flow` invertido.
   - Llama `persist({ ...s, status: prev })`.
   - Toast: "Estado revertido a [Estado anterior]".
   - **No** borra los datos ya capturados (flete, gastos de aduana, medidas) — quedan disponibles si el usuario decide volver a avanzar.

4. **Bloqueo de seguridad**: si `status === 'CERRADO'`, el botón no aparece. Para revertir un embarque cerrado se debe usar el flujo de eliminación existente (que ya advierte sobre ajustes manuales en contabilidad).

### Archivos a modificar
- `src/pages/shipments/Index.tsx`:
  - Nuevo estado `revertConfirm` con pasos 1/2.
  - Función `handleRevert` y `confirmRevert`.
  - Pasar `onRevert` a `ShipmentDetail`.
  - Renderizar botón "Retroceder" + `AlertDialog` de doble confirmación.

### Resultado esperado para EMB-2026-002
Una vez aplicado el cambio, el usuario podrá:
1. Abrir EMB-2026-002 (estado `FLETE_PAGADO`).
2. Hacer clic en "Retroceder estado" → confirmar paso 1 → confirmar paso 2.
3. El embarque vuelve a `EN_COMPRA` sin pérdida de datos.

