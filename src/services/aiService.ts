// src/services/aiService.ts
// Servicio de IA para generación automática de asientos contables — powered by Google Gemini

import { Account } from '@/accounting/types';
import { todayISO } from '@/accounting/utils';

export interface AIJournalLine {
  account_id: string;
  account_name: string;
  debit: number;
  credit: number;
  side_label: string; // e.g. "A+" o "G+"
}

export interface AIJournalSuggestion {
  date: string;
  memo: string;
  lines: AIJournalLine[];
  explanation: string;
}

export interface AIParseResult {
  suggestions: AIJournalSuggestion[];
  raw_interpretation: string;
}

const GEMINI_API_KEY = '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';
const GEMINI_API_URL = `https://api.groq.com/openai/v1`;

function buildPrompt(accounts: Account[], userText: string, today: string, yesterdayISO: string): string {
  const accountList = accounts
    .filter(a => a.is_active)
    .map(a => {
      const typeAbbr: Record<string, string> = {
        ACTIVO: 'A', PASIVO: 'P', PATRIMONIO: 'Pn', INGRESO: 'I', GASTO: 'G',
      };
      const abbr = typeAbbr[a.type] || a.type;
      const normalSide = a.normal_side === 'DEBE' ? 'aumenta en Debe' : 'aumenta en Haber';
      return `- ${a.id} | ${a.name} | Tipo: ${a.type} (${abbr}) | ${normalSide}`;
    })
    .join('\n');

  return `Eres un contador experto en Bolivia que genera asientos contables de partida doble.
El usuario te dará descripciones en lenguaje natural de transacciones (puede haber una o varias).
Tu tarea es interpretar cada transacción y generar el asiento contable correcto.

PLAN DE CUENTAS DISPONIBLE:
${accountList}

REGLAS CONTABLES:
- Todo asiento debe cuadrar: suma de Débitos = suma de Créditos
- Activos y Gastos aumentan en el DEBE (débito)
- Pasivos, Patrimonio e Ingresos aumentan en el HABER (crédito)
- Usa SOLO las cuentas del plan de cuentas listado arriba
- Si el usuario dice "banco", "efectivo", "pago", usa la cuenta de Banco MN o Caja MN según corresponda
- Para gastos sin especificar cuenta, usa "Gastos Generales"
- Para compras de activos/inventario usa la cuenta de Inventario o Activos según aplique
- "Ayer" = fecha de ayer, "hoy" = fecha de hoy, "hace X días" = calcula la fecha

FORMATO DE RESPUESTA: Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON.

El JSON debe tener esta estructura exacta:
{
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "memo": "Descripción breve del asiento",
      "lines": [
        {
          "account_id": "G.1",
          "account_name": "Gastos Generales",
          "debit": 50,
          "credit": 0,
          "side_label": "G+"
        },
        {
          "account_id": "A.1",
          "account_name": "Banco MN",
          "debit": 0,
          "credit": 50,
          "side_label": "A-"
        }
      ],
      "explanation": "Se registra el gasto pagado con banco"
    }
  ],
  "raw_interpretation": "Interpretación general de lo que el usuario describió"
}

Para side_label: usa el tipo de cuenta (A, P, Pn, I, G) seguido de + si aumenta o - si disminuye.
Ejemplos: A+ (activo sube), A- (activo baja), G+ (gasto sube), I+ (ingreso sube), P+ (pasivo sube)

---

Hoy es ${today} (ayer fue ${yesterdayISO}).

Genera los asientos contables para las siguientes transacciones:

${userText}`;
}

export async function generateJournalEntries(
  userText: string,
  accounts: Account[]
): Promise<AIParseResult> {
  const today = todayISO();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayISO = yesterdayDate.toISOString().slice(0, 10);

  const prompt = buildPrompt(accounts, userText, today, yesterdayISO);

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error de API Gemini: ${response.status}`);
  }

  const data = await response.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!rawText) {
    throw new Error('Gemini no devolvió respuesta. Intenta de nuevo.');
  }

  // Clean possible markdown code blocks just in case
  const clean = rawText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(clean) as AIParseResult;
  } catch {
    throw new Error('La IA devolvió una respuesta no válida. Intenta reformular tu descripción.');
  }
}
