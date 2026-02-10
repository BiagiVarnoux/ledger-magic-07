
# Documento de Prompt para Recrear el Sistema Contable

Este documento contiene los prompts detallados para recrear la aplicacion contable completa, divididos en 4 fases secuenciales.

---

## FASE 1: Plan de Cuentas + Libro Diario (Base del Sistema)

### Prompt:

```text
Crea una aplicacion web de contabilidad en espanol (boliviano) usando React, TypeScript, Tailwind CSS, shadcn/ui y Supabase (PostgreSQL + Auth).

=== AUTENTICACION ===
- Login/Registro con email y password usando Supabase Auth.
- Al registrarse un usuario nuevo, asignarle automaticamente el rol "owner" en una tabla user_roles.
- Cada usuario solo ve sus propios datos (RLS con auth.uid() = user_id).

=== MODULO 1: PLAN DE CUENTAS ===

Tabla "accounts" en PostgreSQL:
- id: TEXT PRIMARY KEY (ej: "A.1", "G.2", "Pn.1") — lo asigna el usuario
- name: TEXT NOT NULL (ej: "Banco MN", "Caja MN")
- type: TEXT NOT NULL — valores permitidos: ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO
- normal_side: TEXT NOT NULL — valores: DEBE, HABER
- is_active: BOOLEAN DEFAULT TRUE
- user_id: UUID NOT NULL REFERENCES auth.users(id)
- expense_category: TEXT NULLABLE — solo para tipo GASTO, valores: COSTO_VENTAS, GASTO_OPERATIVO, OTRO_GASTO
- is_cash_equivalent: BOOLEAN DEFAULT FALSE — solo para tipo ACTIVO, marca si es efectivo/equivalente
- is_current: BOOLEAN NULLABLE — para ACTIVO y PASIVO, TRUE=corriente, FALSE=no corriente, NULL=automatico
- created_at: TIMESTAMPTZ DEFAULT now()

RLS: Habilitar en accounts. Policy: user_id = auth.uid() para SELECT, INSERT, UPDATE, DELETE.

UI del Plan de Cuentas (/accounts):
- Formulario superior: campos Codigo, Nombre, Tipo (select), Lado Normal (select), checkbox Activa.
- Campos condicionales que aparecen segun el tipo:
  - Si tipo = GASTO: mostrar select "Categoria de Gasto" (Costo de Ventas, Gasto Operativo, Otro Gasto, Sin clasificar)
  - Si tipo = ACTIVO o PASIVO: mostrar select "Clasificacion" (Automatico, Corriente, No Corriente)
  - Si tipo = ACTIVO: mostrar checkbox "Es efectivo o equivalente"
- Tabla con columnas: Codigo, Nombre, Tipo, Lado, Clasificacion (badges de colores), Estado, Acciones.
- Acciones: Editar (carga datos en el formulario), Activar/Desactivar, Eliminar (solo si no tiene movimientos).
- Ordenar por codigo (id).

Cuentas semilla (insertar por defecto al primer uso):
A.1 Banco MN (ACTIVO/DEBE), A.2 Caja MN (ACTIVO/DEBE), A.3 Banco ME (ACTIVO/DEBE),
A.4 Inventario (ACTIVO/DEBE), A.5 Cuentas por Cobrar (ACTIVO/DEBE),
A.6 Credito Fiscal IVA (ACTIVO/DEBE), A.7 USDT (ACTIVO/DEBE),
G.1 Gastos Generales (GASTO/DEBE), G.2 Flete Aereo (GASTO/DEBE),
G.3 IT (GASTO/DEBE), G.4 Costo de Ventas (GASTO/DEBE),
I.1 Ventas (INGRESO/HABER),
P.1 Cuentas por Pagar (PASIVO/HABER), P.2 IT por Pagar (PASIVO/HABER),
P.3 Debito Fiscal IVA (PASIVO/HABER),
Pn.1 Capital (PATRIMONIO/HABER)

=== MODULO 2: LIBRO DIARIO ===

Tablas:
- journal_entries:
  - id: TEXT PRIMARY KEY (formato: "001-Q1-25", secuencial por trimestre)
  - date: DATE NOT NULL
  - memo: TEXT NULLABLE (glosa del asiento)
  - void_of: TEXT NULLABLE (si es anulacion, referencia al asiento original)
  - user_id: UUID NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

- journal_lines:
  - id: SERIAL PRIMARY KEY
  - entry_id: TEXT NOT NULL REFERENCES journal_entries(id)
  - account_id: TEXT NOT NULL REFERENCES accounts(id)
  - debit: NUMERIC(15,2) DEFAULT 0
  - credit: NUMERIC(15,2) DEFAULT 0
  - line_memo: TEXT NULLABLE
  - RLS: basado en user_id del journal_entry padre

Formato del ID del asiento:
- Formato: NNN-Qq-AA (ej: "001-Q1-25", "042-Q4-25")
- NNN = numero secuencial con 3 digitos, reinicia por trimestre
- Qq = trimestre (Q1, Q2, Q3, Q4)
- AA = ultimos 2 digitos del anio
- El sistema calcula automaticamente el trimestre a partir de la fecha del asiento.

REGLA CRITICA DE REDONDEO:
Crear funcion utilitaria round2(n: number): number => Math.round(n * 100) / 100
APLICAR round2() en TODOS estos puntos:
1. Al guardar cada linea: debit = round2(debit), credit = round2(credit)
2. Al calcular saldos: signedBalanceFor(deb, hab, side) = round2(side === "DEBE" ? deb - hab : hab - deb)
3. Al validar cuadratura: sum(debit) debe ser EXACTAMENTE igual a sum(credit) tras round2()
4. En todos los reportes al acumular saldos

UI del Libro Diario (/journal):
- Selector de trimestre arriba (Q1 2025, Q2 2025, etc.)
- Formulario de nuevo asiento:
  - Fecha (date picker), Glosa general (text)
  - Tabla de lineas con: Cuenta (combobox con busqueda), Debe, Haber, Glosa de linea, boton eliminar linea
  - Indicador +/- al lado de cada linea segun si el movimiento aumenta (+) o disminuye (-) la cuenta
  - Boton "Agregar linea"
  - Resumen inferior: Total Debe, Total Haber, Diferencia (resaltar en rojo si != 0)
  - Boton Guardar (deshabilitado si diferencia != 0 o menos de 2 lineas)
- Tabla de asientos existentes:
  - Columnas: ID, Fecha, Glosa, Cuentas, Debe, Haber, Acciones
  - Indicador visual (badge rojo con triangulo de alerta) si el asiento esta descuadrado
  - Acciones: Editar, Anular (crea asiento inverso con void_of), Eliminar (con confirmacion)
  - Ordenar por fecha y ID, toggle asc/desc
- Filtros colapsables: busqueda por texto, rango de fechas, cuenta, rango de montos, mostrar/ocultar anulados
- Exportar a CSV

Formato de numeros: usar formato boliviano "es-BO" con 2 decimales (ej: 1.234,56).
Para input: aceptar coma como separador decimal.

Anulacion de asientos:
- Al anular, crear nuevo asiento con las lineas invertidas (debit <-> credit)
- El nuevo asiento tiene void_of = id del asiento original
- Memo del nuevo asiento: "[memo original] (ANULACION)"
```

---

## FASE 2: Libro Mayor + Reportes Financieros

### Prompt:

```text
Continuando con la app contable de la Fase 1 (Plan de Cuentas + Libro Diario ya implementados):

=== MODULO 3: LIBRO MAYOR ===

Pagina /ledger:
- Selector de cuenta (select con todas las cuentas, formato "A.1 — Banco MN")
- Selector de trimestre
- Tabla con: Fecha, Asiento (ID), Glosa, Debe, Haber, Saldo acumulado
- Primera fila: "Saldo Inicial" (calculado de trimestres anteriores)
- Saldo acumulado: running balance que empieza en saldo inicial
- Mostrar arriba: Saldo inicial y Saldo final
- Exportar a CSV

Tabla "quarterly_closures" para persistir saldos de cierre:
- id: UUID PRIMARY KEY
- closure_date: DATE NOT NULL (ultimo dia del trimestre)
- balances: JSONB NOT NULL (mapa de account_id -> saldo)
- user_id: UUID NOT NULL
- created_at: TIMESTAMPTZ DEFAULT now()

Logica del saldo inicial:
1. Buscar en quarterly_closures el cierre del trimestre anterior
2. Si no existe, calcularlo sumando todos los movimientos hasta la fecha de inicio del trimestre
3. Para cada linea: saldo += signedBalanceFor(debit, credit, normal_side)

=== MODULO 4: REPORTES FINANCIEROS ===

Pagina /reports con 4 pestanas (Tabs):

--- 4A: Balance de Comprobacion (Trial Balance) ---
- Selector de trimestre
- Tabla: Codigo, Cuenta, Debe (total), Haber (total), Saldo
- Saldo = segun normal_side: DEBE -> debit - credit, HABER -> credit - debit
- Fila de totales al final
- Exportar PDF

--- 4B: Estado de Resultados (Income Statement - NIIF) ---
- Selector de periodo: Trimestral o Anual
- Estructura NIIF con secciones:
  1. INGRESOS POR VENTAS (cuentas tipo INGRESO)
     → Total Ingresos (100%)
  2. (-) COSTO DE VENTAS (cuentas GASTO con expense_category = COSTO_VENTAS, o fallback por keywords: "costo de venta", "costo de mercancia", "costo producto")
     → Total Costo de Ventas
  3. = UTILIDAD BRUTA (con margen bruto %)
  4. (-) GASTOS OPERATIVOS (cuentas GASTO con expense_category = GASTO_OPERATIVO, o fallback por keywords: "gasto", "administrativo", "flete", "operativo", "general")
     → Total Gastos Operativos
  5. = UTILIDAD OPERATIVA / EBIT (con margen operativo %)
  6. (-) OTROS GASTOS (cuentas GASTO con expense_category = OTRO_GASTO, o fallback por keywords: "it", "interes", "comision", "bancario", "financiero")
  7. = UTILIDAD ANTES DE IMPUESTOS
  8. (-) Impuesto a la Renta (solo para reporte anual, si esta habilitado en configuracion)
     → Tasa configurable (default 25%)
  9. = UTILIDAD NETA (con margen neto %)
- Mostrar margenes como % y con icono de tendencia (TrendingUp/TrendingDown)
- Indicadores de rendimiento: cards con Margen Bruto, Margen Operativo, Margen Neto
- Exportar PDF

Tabla "report_settings" para configuracion del Estado de Resultados:
- id: UUID PRIMARY KEY
- user_id: UUID NOT NULL
- tax_rate: NUMERIC DEFAULT 25
- tax_enabled: BOOLEAN DEFAULT FALSE
- cost_of_sales_keywords: TEXT[] (array de palabras clave)
- operating_expense_keywords: TEXT[] (array)
- other_expense_keywords: TEXT[] (array)

--- 4C: Balance General (NIIF - Estado de Situacion Financiera) ---
- Selector de fecha de corte
- Layout en 2 columnas:
  - Columna izquierda: ACTIVOS
    - Activos Corrientes (cuentas con is_current=true, o fallback por keywords: caja, banco, efectivo, cobrar, inventario, iva, credito fiscal, usdt)
    - Activos No Corrientes (is_current=false o las que no matchean keywords)
    - TOTAL ACTIVOS
  - Columna derecha: PASIVO + PATRIMONIO
    - Pasivos Corrientes (is_current=true, o keywords: pagar, proveedor, iva, debito fiscal, impuesto)
    - Pasivos No Corrientes
    - Total Pasivos
    - PATRIMONIO (cuentas tipo PATRIMONIO + "Resultado del Ejercicio" calculado como ingresos - gastos)
    - Total Patrimonio
    - TOTAL PASIVO + PATRIMONIO
- Verificacion: Activos - (Pasivo + Patrimonio) = 0.00 (mostrar check verde o X roja)
- APLICAR round2() al calcular el saldo de cada cuenta y en cada subtotal
- Ratios financieros: Razon Corriente, Razon de Endeudamiento (%), Capital de Trabajo
- Exportar PDF

--- 4D: Flujo de Caja (NIC 7 - Metodo Directo) ---
- Selector de periodo: Trimestral o Anual
- Identificar cuentas de efectivo: usar flag is_cash_equivalent=true, fallback keywords (banco, caja, efectivo, usdt)
- Mostrar "Efectivo y equivalentes: [lista de cuentas identificadas]"
- Saldo Inicial de Efectivo (antes del periodo)
- Clasificacion de movimientos segun NIC 7:
  1. Actividades de Operacion (NIC 7.14-20): ingresos, gastos, cuentas por cobrar/pagar, inventario, impuestos
  2. Actividades de Inversion (NIC 7.16): activos fijos, inversiones
  3. Actividades de Financiacion (NIC 7.17): capital, prestamos, patrimonio
- Cada seccion: lista de cuentas con monto, subtotal de flujo neto
- Variacion Neta de Efectivo = Operacion + Inversion + Financiacion
- Saldo Final = Saldo Inicial + Variacion Neta (con linea de verificacion)
- Ratios: Cobertura de Efectivo (Flujo Operativo / Pasivos), Crecimiento de Efectivo (%)
- Exportar PDF

=== EXPORTACION PDF ===
Usar jsPDF + jspdf-autotable.
Cada reporte PDF incluye: titulo centrado, subtitulo, fecha/periodo, linea separadora, tabla con autoTable, pie de pagina con numero de pagina y fecha de generacion.
```

---

## FASE 3: Libros Auxiliares + Kardex (Inventarios)

### Prompt:

```text
Continuando con la app contable (Fases 1 y 2 ya implementadas):

=== MODULO 5: LIBROS AUXILIARES ===

Concepto: Los libros auxiliares permiten desglosar cuentas contables por clientes/terceros. Por ejemplo, la cuenta "Cuentas por Cobrar" se desglosa por cliente mostrando cuanto debe cada uno.

Tablas:

- auxiliary_ledger_definitions:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - name: TEXT NOT NULL (nombre del libro auxiliar, ej: "Clientes por Cobrar")
  - account_id: TEXT NOT NULL REFERENCES accounts(id) (cuenta contable asociada)
  - user_id: UUID NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

- auxiliary_ledger:
  - id: TEXT PRIMARY KEY (UUID generado como texto)
  - client_name: TEXT NOT NULL (nombre del cliente/tercero)
  - account_id: TEXT NOT NULL REFERENCES accounts(id)
  - definition_id: UUID NULLABLE REFERENCES auxiliary_ledger_definitions(id)
  - user_id: UUID NOT NULL
  - created_at, updated_at: TIMESTAMPTZ

- auxiliary_movement_details:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - aux_entry_id: TEXT NOT NULL (FK a auxiliary_ledger.id)
  - journal_entry_id: TEXT NOT NULL (FK a journal_entries.id)
  - movement_date: DATE NOT NULL
  - amount: NUMERIC NOT NULL
  - movement_type: TEXT NOT NULL (valores: 'INCREASE' o 'DECREASE')
  - user_id: UUID NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

- Trigger: Al eliminar un journal_entry, eliminar automaticamente los auxiliary_movement_details asociados.

UI Libros Auxiliares (/auxiliary-ledgers):
- Boton "Definiciones" que abre modal para crear/editar/eliminar definiciones de libros auxiliares
- Selector de libro auxiliar (definicion)
- Tabla de clientes/terceros: Nombre, Saldo total (calculado de movimientos), Acciones
- Al hacer clic en un cliente: modal con detalle de movimientos (fecha, asiento, monto, tipo)
- El saldo total se calcula: SUM(INCREASE) - SUM(DECREASE)

Integracion con Libro Diario:
- Al guardar un asiento que incluye una cuenta con libro auxiliar definido:
  1. Detectar las lineas que usan cuentas con auxiliary_ledger_definitions
  2. Mostrar modal preguntando: a que cliente/tercero asignar cada movimiento
  3. Opciones: seleccionar cliente existente o crear nuevo
  4. Determinar si es INCREASE o DECREASE segun el normal_side de la cuenta
  5. Guardar el auxiliary_movement_detail vinculado al journal_entry_id

=== MODULO 6: KARDEX (Costo Promedio Ponderado - CPP) ===

Concepto: Registro de movimientos de inventario con calculo de Costo Promedio Ponderado.

Tablas:

- kardex_definitions:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - name: TEXT NOT NULL (nombre del producto/inventario)
  - account_id: TEXT NOT NULL REFERENCES accounts(id) (cuenta contable asociada, ej: "A.4 Inventario")
  - user_id: UUID NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

- kardex_entries:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - account_id: TEXT NOT NULL
  - user_id: UUID NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

- kardex_movements:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - kardex_id: UUID NOT NULL REFERENCES kardex_entries(id)
  - user_id: UUID NOT NULL
  - fecha: DATE NOT NULL
  - concepto: TEXT NOT NULL
  - entrada: NUMERIC DEFAULT 0 (unidades que entran)
  - salidas: NUMERIC DEFAULT 0 (unidades que salen)
  - saldo: NUMERIC DEFAULT 0 (unidades en stock)
  - costo_unitario: NUMERIC DEFAULT 0
  - costo_total: NUMERIC DEFAULT 0 (para entradas: costo de compra; para salidas: calculado)
  - saldo_valorado: NUMERIC DEFAULT 0
  - journal_entry_id: TEXT NULLABLE
  - created_at: TIMESTAMPTZ DEFAULT now()

Logica del CPP (Costo Promedio Ponderado) - CENTRALIZAR en funcion calculateCPP():
- Para ENTRADAS (compras):
  saldo_valorado_nuevo = saldo_valorado_anterior + costo_total_compra
  saldo_nuevo = saldo_anterior + entrada
  costo_unitario_nuevo = saldo_valorado_nuevo / saldo_nuevo
- Para SALIDAS (ventas):
  costo_unitario = saldo_valorado_actual / saldo_actual (CPP vigente)
  saldo_nuevo = saldo_actual - salidas
  costo_total_salida = salidas * costo_unitario
  saldo_valorado_nuevo = saldo_valorado_actual - costo_total_salida

Integracion con Libro Diario:
- Al guardar un asiento que incluye una cuenta con kardex_definition:
  1. Detectar la linea y mostrar popup inline
  2. El popup pregunta: Concepto, Cantidad entrada, Cantidad salida, Costo total (solo para entradas)
  3. El sistema calcula automaticamente el CPP usando calculateCPP()
  4. Guarda el kardex_movement vinculado al journal_entry_id

UI del Kardex:
- Boton "Definiciones" para crear/eliminar definiciones de kardex
- Modal de visualizacion: tabla con columnas Fecha, Concepto, Entrada, Salida, Saldo, Costo Unit., Costo Total, Saldo Valorado
- Los valores de CPP se recalculan en tiempo real desde los movimientos historicos para evitar datos corruptos
```

---

## FASE 4: Configuracion, Seguridad y Acceso Compartido

### Prompt:

```text
Continuando con la app contable (Fases 1-3 ya implementadas):

=== MODULO 7: SISTEMA DE ROLES Y ACCESO COMPARTIDO ===

Concepto: El propietario (owner) puede generar codigos de invitacion para que otros usuarios vean sus datos contables en modo solo lectura, con permisos granulares.

Tablas:

- user_roles:
  - user_id: UUID PRIMARY KEY REFERENCES auth.users(id)
  - role: app_role NOT NULL (crear ENUM app_role con valores: 'owner', 'viewer')
  - created_at: TIMESTAMPTZ DEFAULT now()

- shared_access:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - owner_id: UUID NOT NULL REFERENCES auth.users(id)
  - viewer_id: UUID NOT NULL REFERENCES auth.users(id)
  - can_view_accounts: BOOLEAN DEFAULT TRUE
  - can_view_journal: BOOLEAN DEFAULT TRUE
  - can_view_auxiliary: BOOLEAN DEFAULT TRUE
  - can_view_ledger: BOOLEAN DEFAULT TRUE
  - can_view_reports: BOOLEAN DEFAULT TRUE
  - created_at: TIMESTAMPTZ DEFAULT now()

- invitation_codes:
  - id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - code: TEXT UNIQUE NOT NULL
  - owner_id: UUID NOT NULL REFERENCES auth.users(id)
  - can_view_accounts, can_view_journal, can_view_auxiliary, can_view_ledger, can_view_reports: BOOLEAN DEFAULT TRUE
  - used: BOOLEAN DEFAULT FALSE
  - used_by: UUID NULLABLE
  - expires_at: TIMESTAMPTZ NOT NULL
  - created_at: TIMESTAMPTZ DEFAULT now()

Funciones RPC en PostgreSQL:

1. handle_new_user_role(): Trigger AFTER INSERT en auth.users -> inserta owner role por defecto.

2. assign_default_owner_role(_user_id UUID): Inserta rol owner si no existe (ON CONFLICT DO NOTHING).

3. redeem_invitation_code(_code TEXT, _user_id UUID):
   - Valida que el codigo existe, no esta usado, no esta expirado
   - Marca el codigo como usado
   - Crea registro en shared_access con los permisos del codigo
   - Elimina roles existentes del usuario
   - Asigna rol 'viewer'
   - Retorna JSON con success y permisos

4. revoke_shared_access(_owner_id UUID, _viewer_id UUID):
   - Elimina el registro de shared_access
   - Si el viewer no tiene mas accesos compartidos, elimina su rol 'viewer'

5. has_role(_user_id UUID, _role app_role): Retorna boolean.

6. has_shared_access(_viewer_id UUID, _owner_id UUID): Retorna boolean.

Flujo de autenticacion:
- Al hacer login, verificar si hay codigo de invitacion pendiente en localStorage
- Si hay codigo: llamar redeem_invitation_code y redirigir a /viewer-dashboard
- Si no hay codigo: llamar assign_default_owner_role

Context de acceso (UserAccessProvider):
- Proveer: isOwner, isViewer, isReadOnly, loading, permissions, targetUserId
- Si es viewer: cargar shared_access para obtener permisos granulares
- isReadOnly = isViewer (los viewers no pueden modificar nada)

Navegacion:
- Owner: Plan de Cuentas, Libro Diario, Libros Auxiliares, Libro Mayor, Reportes, Configuracion
- Viewer: Panel (dashboard viewer), y solo las secciones que tenga permiso
- Mostrar badge "Solo lectura" en el header cuando isReadOnly = true
- Mostrar banner amarillo en cada pagina cuando es solo lectura

RLS Avanzado:
- Las tablas deben permitir SELECT si:
  - user_id = auth.uid() (datos propios), O
  - has_shared_access(auth.uid(), user_id) = true (datos compartidos con el viewer)
- INSERT, UPDATE, DELETE: solo user_id = auth.uid()

=== MODULO 8: CONFIGURACION ===

Pagina /settings (solo para owners):

1. Configuracion de Impuestos (TaxSettingsCard):
   - Toggle habilitar/deshabilitar impuesto
   - Campo tasa de impuesto (default 25%)
   - Guarda en tabla report_settings

2. Backup y Restauracion:
   - Exportar backup: descarga JSON con todos los datos (accounts, journal_entries, journal_lines, auxiliary_*, kardex_*)
   - Importar backup: sube JSON y restaura todos los datos (con confirmacion)
   - Modal con botones Exportar/Importar

3. Historial de Auditoria:
   - Tabla audit_log: id, user_id, table_name, record_id, action (INSERT/UPDATE/DELETE), old_values (JSONB), new_values (JSONB), changed_fields (TEXT[]), created_at
   - Modal que muestra los ultimos cambios con filtros

4. Codigos de Invitacion:
   - Formulario: dias de expiracion, permisos (toggles para cada seccion)
   - Boton "Generar Codigo"
   - Tabla de codigos generados: codigo (con boton copiar), estado (Activo/Usado), expiracion, permisos, acciones (eliminar)

5. Usuarios con Acceso:
   - Tabla de shared_access: ID usuario (truncado), permisos, fecha, boton revocar
   - Confirmacion antes de revocar

=== MODULO 9: EXPORTACION Y SERVICIOS ===

- CSV: Libro Diario (todas las lineas), Libro Mayor (por cuenta y trimestre)
- PDF (jsPDF + jspdf-autotable): Balance Comprobacion, Estado Resultados NIIF, Balance General NIIF, Flujo de Caja NIC 7
- Cada PDF: header con titulo centrado, tabla formateada, footer con pagina y fecha

=== ARQUITECTURA CRITICA ===

Data Adapter Pattern:
- Interfaz IDataAdapter con metodos: loadAccounts, upsertAccount, deleteAccount, loadEntries, saveEntry, deleteEntry, etc.
- Implementacion LocalAdapter (localStorage como fallback)
- Implementacion SupaAdapter (Supabase como fuente primaria)
- pickAdapter(): detecta si Supabase esta disponible, retorna SupaAdapter o LocalAdapter

AccountingProvider (React Context):
- Carga todos los datos al inicio: accounts, entries, auxiliaryEntries, auxiliaryDefinitions, kardexDefinitions
- Provee setters y el adapter activo
- Todos los componentes usan useAccounting() para acceder a los datos

=== REGLA CRITICA FINAL ===
NUNCA almacenar un valor financiero sin aplicar round2() = Math.round(n * 100) / 100.
Esto incluye: lineas de asientos, saldos acumulados, subtotales, totales de reportes, y la verificacion del Balance General.
Sin este redondeo, los errores de punto flotante de JavaScript causan descuadres de $0.01 que rompen la ecuacion contable.
```

---

## Notas para el Desarrollador / IA

1. **Orden de construccion**: Fase 1 -> Fase 2 -> Fase 3 -> Fase 4. No saltar fases.
2. **Cada fase debe funcionar antes de pasar a la siguiente**. Probar que el Balance General cuadra antes de continuar.
3. **Idioma**: Toda la UI esta en espanol. Variables y funciones pueden estar en ingles o espanol, ser consistente.
4. **Formato numerico**: Usar locale "es-BO" (punto como separador de miles, coma como decimal). Ejemplo: 1.234,56
5. **Trimestres**: Q1=Ene-Mar, Q2=Abr-Jun, Q3=Jul-Sep, Q4=Oct-Dic
6. **Componentes UI**: Usar shadcn/ui (Card, Table, Select, Input, Dialog, Tabs, Badge, Button, etc.)
7. **Stack**: React 18+, TypeScript, Vite, Tailwind CSS, Supabase (Auth + PostgreSQL + RLS), React Router v6
8. **Librerias adicionales**: jsPDF, jspdf-autotable (PDFs), recharts (graficos opcionales), sonner/toast (notificaciones), lucide-react (iconos)
