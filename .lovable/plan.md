

## Asistente de IA Contable con Gemini

### Que hace

Agrega una nueva pestana **"Asistente IA"** en la navegacion. Al abrirla, veras un chat donde puedes hacer preguntas sobre tu contabilidad. La IA tendra acceso completo a:

- Plan de cuentas con tipos y saldos
- Libro diario (entradas recientes)
- Resumen del Balance General y Estado de Resultados
- Libros auxiliares y definiciones

Podras pedirle cosas como:
- "Cual es mi margen bruto este trimestre?"
- "Dame un resumen ejecutivo de mis finanzas"
- "Compara mis gastos Q3 vs Q4"
- "Que cuentas tienen saldo inusual?"

### Sobre modificar el codigo

Una aplicacion web desplegada **no puede auto-editarse**. Sin embargo, la IA SI podra:
- **Analizar la estructura** del programa (le pasamos un resumen de las paginas y funcionalidades)
- **Sugerir mejoras** especificas que luego puedes copiar y pegar aqui en Lovable
- Por ejemplo: "Sugiereme como agregar una columna de porcentaje al Balance General" y la IA te dara la sugerencia que pegas en este chat

---

### Cambios Tecnicos

#### 1. Edge Function: `supabase/functions/chat/index.ts` (CREAR)

- Recibe mensajes del usuario + contexto contable (cuentas, saldos, entradas)
- Llama al gateway de Lovable AI (Gemini) con streaming SSE
- System prompt especializado: asistente contable experto en NIIF, responde en espanol
- Maneja errores 429 (rate limit) y 402 (creditos)

#### 2. Nueva pagina: `src/pages/ai-assistant/Index.tsx` (CREAR)

- Chat con mensajes usuario/IA, scroll automatico
- Al cargar, recopila automaticamente el contexto contable desde `useAccounting()`
- Streaming token por token (respuesta fluida)
- Renderizado markdown para respuestas formateadas (tablas, listas, negritas)
- Indicador "escribiendo..." mientras genera

El contexto contable que se envia incluye:
- Lista completa de cuentas con tipo, saldo normal y categoria
- Ultimas 20 entradas del libro diario con sus lineas
- Totales por tipo de cuenta (total activos, pasivos, patrimonio, ingresos, gastos)
- Definiciones de libros auxiliares

#### 3. Navegacion y ruta

- **`src/App.tsx`**: Agregar ruta `/ai-assistant`
- **`src/components/layout/AppShell.tsx`**: Agregar boton "Asistente IA" en la nav (visible para owners)

#### 4. Configuracion

- **`supabase/config.toml`**: Registrar funcion `chat` con `verify_jwt = false`
- Usa `LOVABLE_API_KEY` (ya disponible automaticamente, no necesitas configurar nada)

---

### Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/chat/index.ts` | Crear - Edge function con streaming |
| `supabase/config.toml` | Modificar - Registrar funcion chat |
| `src/pages/ai-assistant/Index.tsx` | Crear - Pagina del chat |
| `src/App.tsx` | Modificar - Agregar ruta |
| `src/components/layout/AppShell.tsx` | Modificar - Agregar enlace en nav |

---

### Flujo de uso

1. Clic en "Asistente IA" en la barra de navegacion
2. Se abre el chat, el sistema carga tu contexto contable automaticamente
3. Escribes una pregunta o solicitud
4. La IA responde en tiempo real con acceso a todos tus datos
5. Puedes continuar la conversacion con preguntas de seguimiento
6. Si pides sugerencias de codigo, la IA te dara texto que puedes copiar y pegar en Lovable

