# Sincronización Glosa ↔ Concepto Kárdex

## Objetivo
Cuando se registra un asiento en el Libro Diario y una línea tiene cuenta con Kárdex, la glosa de la línea (o, si está vacía, el memo general del asiento) debe pre-cargarse automáticamente como **Concepto** en el pop-up de Kárdex. Y al revés: si el usuario escribe el Concepto en el pop-up de Kárdex y la glosa de la línea está vacía, el concepto se copia a la glosa.

## Comportamiento

### Diario → Kárdex (nuevo)
Al abrir el pop-up de Kárdex (al elegir una cuenta con Kárdex en una línea):
- Si la línea ya tiene `line_memo`, se usa como Concepto inicial.
- Si la línea no tiene `line_memo` pero el asiento tiene `memo` general, se usa ese memo.
- Si el usuario reabre el pop-up de una línea que ya tiene `kardexData`, se mantiene el comportamiento actual (se carga `kardexData.concepto`).

### Kárdex → Diario (ya existe parcialmente, se conserva)
Al guardar el pop-up de Kárdex, el `concepto` se copia siempre al `line_memo` de la línea (lógica actual en `useJournalForm.handleKardexPopupSave`). No se modifica.

## Archivos a modificar

1. **`src/components/kardex/InlineKardexPopup.tsx`**
   - Añadir prop opcional `initialConcepto?: string`.
   - En el `useEffect` de reset (rama sin `initialData`), inicializar `concepto` con `initialConcepto ?? ''`.

2. **`src/hooks/useJournalForm.ts`**
   - Extender la firma de `onKardexPopupOpen` para incluir `lineMemo?: string`.
   - En `handleAccountChange`, pasar `newLine.line_memo || memo` (memo general como fallback) al abrir el pop-up.

3. **`src/pages/journal/Index.tsx`**
   - Añadir `lineMemo?: string` al state `kardexPopupState`.
   - Guardarlo cuando se abre el pop-up.
   - Pasar `initialConcepto={kardexPopupState.lineMemo}` al `<InlineKardexPopup>`.

## No se toca
- Lógica contable, validaciones, cálculo de saldos/CPP.
- Comportamiento del pop-up al editar (`initialData` sigue mandando).
- Modal de Auxiliares ni FIFO.
