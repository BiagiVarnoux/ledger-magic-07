## Corregir el Asistente IA: datos "undefined" y acceso limitado

### Problemas encontrados

Hay dos problemas claros en el codigo actual:

1. **Cuentas aparecen como "undefined"**: La funcion `buildAccountingContext` usa nombres de propiedades en camelCase (`l.accountId`, `a.normalSide`, `a.isActive`) pero los datos reales usan snake_case (`l.account_id`, `a.normal_side`, `a.is_active`). Por eso todo aparece como "undefined".
2. **Solo 20 entradas**: La funcion solo envia las ultimas 20 entradas del libro diario (`entries.slice(-20)`), lo cual es insuficiente para analizar trimestres completos.

### Solucion

Modificar **un solo archivo**: `src/pages/ai-assistant/Index.tsx`

#### Cambios en `buildAccountingContext`:

1. **Corregir los nombres de propiedades** a snake_case para que coincidan con los tipos reales:
  - `a.normalSide` -> `a.normal_side`
  - `a.isActive` -> `a.is_active`
  - `a.expenseCategory` -> `a.expense_category`
  - `l.accountId` -> `l.account_id`
  - `d.accountId` -> `d.account_id`
2. **Enviar TODAS las entradas** del libro diario en vez de solo las ultimas 20. Cambiar el titulo de la seccion y eliminar el `.slice(-20)`.
3. **Resolver los nombres de cuenta** en las lineas del diario: en vez de mostrar solo el codigo de cuenta, buscar el nombre completo de la cuenta para dar mejor contexto a la IA. Ejemplo: en vez de `A.1: Debito=660`, mostrara `A.1 Banco MN: Debito=660`.
4. **Agregar saldos por cuenta**: Calcular y mostrar el saldo acumulado de cada cuenta para que la IA tenga acceso a los balances sin necesidad de calcularlo ella misma.
5. **Incluir informacion de equivalentes de efectivo**: Agregar la columna `is_cash_equivalent` en el resumen del plan de cuentas para que la IA pueda identificar cuentas de efectivo al analizar flujos de caja.
6. EL ASISTENTE IA TIENE QUE TENER ACCESO A LOS LIBROS MAYORES, A LOS BALANCES, AL PLAN DE CUENTAS, ETC. NO SOLO A LOS LIBROS DIARIOS !!!!!
  &nbsp;

### Resultado esperado

Despues de estos cambios, cuando le preguntes al Asistente IA sobre tu flujo de caja del Q4 2025:

- Vera todas las entradas de ese periodo (no solo 20)
- Las cuentas apareceran con sus nombres correctos (no "undefined")
- Tendra los saldos calculados de cada cuenta
- Podra identificar cuentas de efectivo correctamente

### Detalles tecnicos

Archivo a modificar: `src/pages/ai-assistant/Index.tsx`

La funcion `buildAccountingContext` se reescribira para:

```text
Antes:
  l.accountId        -> undefined
  a.normalSide       -> undefined  
  a.isActive         -> undefined
  entries.slice(-20) -> solo 20 entradas

Despues:
  l.account_id       -> "A.1"
  a.normal_side      -> "DEBE"
  a.is_active        -> true
  entries (completo)  -> todas las entradas
```

Se agrega una seccion nueva de "Saldos por Cuenta" que calcula debitos totales menos creditos totales por cada cuenta, para que la IA tenga los balances directamente disponibles.