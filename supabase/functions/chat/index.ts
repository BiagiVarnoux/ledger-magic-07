import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un asistente contable experto en Normas Internacionales de Información Financiera (NIIF/IFRS) y contabilidad general. Respondes siempre en español.

Tu rol:
- Analizar datos contables que te proporciona el usuario (plan de cuentas, libro diario, balances, etc.)
- Responder preguntas sobre la situación financiera
- Generar reportes, resúmenes ejecutivos y análisis
- Detectar anomalías o inconsistencias en los registros
- Sugerir mejoras en la estructura contable
- Cuando te pidan sugerencias de código, analiza la estructura de la aplicación y da sugerencias específicas con fragmentos de código que el usuario pueda copiar

Formato de respuesta:
- Usa markdown para formatear tus respuestas (tablas, listas, negritas, etc.)
- Cuando presentes números financieros, usa formato con separador de miles
- Sé conciso pero completo
- Si no tienes suficiente información, pídela específicamente`;

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, accountingContext } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no está configurada");

    // Build system instruction + context
    let systemInstruction = SYSTEM_PROMPT;
    if (accountingContext) {
      systemInstruction += `\n\n--- DATOS CONTABLES DEL USUARIO ---\n${accountingContext}`;
    }

    // Convert OpenAI-style messages to Gemini format
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(`${GEMINI_API_URL}&key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error del servicio de Gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ") || line.trim() === "") continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Emit in OpenAI-compatible format
                const chunk = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream transform error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
