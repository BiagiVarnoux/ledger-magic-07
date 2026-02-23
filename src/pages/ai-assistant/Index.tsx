import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounting } from "@/accounting/AccountingProvider";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

function buildAccountingContext(accounts: any[], entries: any[], auxiliaryDefinitions: any[]) {
  const lines: string[] = [];
  const accMap = new Map<string, any>();
  accounts.forEach((a) => accMap.set(a.id, a));
  const accName = (id: string) => { const a = accMap.get(id); return a ? `${id} ${a.name}` : id; };

  // 1. Plan de Cuentas
  lines.push("## Plan de Cuentas");
  lines.push("Código | Nombre | Tipo | Saldo Normal | Categoría Gasto | Corriente | Equiv. Efectivo | Activa");
  accounts.forEach((a) => {
    lines.push(
      `${a.id} | ${a.name} | ${a.type} | ${a.normal_side} | ${a.expense_category || "-"} | ${a.is_current != null ? (a.is_current ? "Sí" : "No") : "-"} | ${a.is_cash_equivalent ? "Sí" : "No"} | ${a.is_active ? "Sí" : "No"}`
    );
  });

  // 2. Saldos por Cuenta (Mayor)
  const balances: Record<string, { debit: number; credit: number }> = {};
  entries.forEach((e) => {
    e.lines?.forEach((l: any) => {
      const id = l.account_id;
      if (!balances[id]) balances[id] = { debit: 0, credit: 0 };
      balances[id].debit += l.debit || 0;
      balances[id].credit += l.credit || 0;
    });
  });

  lines.push("\n## Libro Mayor – Saldos por Cuenta");
  lines.push("Cuenta | Débitos | Créditos | Saldo");
  Object.entries(balances).forEach(([id, b]) => {
    const acc = accMap.get(id);
    const side = acc?.normal_side;
    const saldo = side === "DEBE" ? b.debit - b.credit : b.credit - b.debit;
    lines.push(`${accName(id)} | ${b.debit.toFixed(2)} | ${b.credit.toFixed(2)} | ${saldo.toFixed(2)}`);
  });

  // 3. Totales por Tipo de Cuenta
  const typeTotals: Record<string, { debit: number; credit: number }> = {};
  Object.entries(balances).forEach(([id, b]) => {
    const acc = accMap.get(id);
    if (acc) {
      if (!typeTotals[acc.type]) typeTotals[acc.type] = { debit: 0, credit: 0 };
      typeTotals[acc.type].debit += b.debit;
      typeTotals[acc.type].credit += b.credit;
    }
  });
  lines.push("\n## Totales por Tipo de Cuenta");
  Object.entries(typeTotals).forEach(([type, t]) => {
    const saldo = type === "ACTIVO" || type === "GASTO" ? t.debit - t.credit : t.credit - t.debit;
    lines.push(`${type}: Débitos=${t.debit.toFixed(2)}, Créditos=${t.credit.toFixed(2)}, Saldo=${saldo.toFixed(2)}`);
  });

  // 4. Balance General resumido
  const totalActivo = (typeTotals["ACTIVO"]?.debit || 0) - (typeTotals["ACTIVO"]?.credit || 0);
  const totalPasivo = (typeTotals["PASIVO"]?.credit || 0) - (typeTotals["PASIVO"]?.debit || 0);
  const totalPatrimonio = (typeTotals["PATRIMONIO"]?.credit || 0) - (typeTotals["PATRIMONIO"]?.debit || 0);
  const totalIngreso = (typeTotals["INGRESO"]?.credit || 0) - (typeTotals["INGRESO"]?.debit || 0);
  const totalGasto = (typeTotals["GASTO"]?.debit || 0) - (typeTotals["GASTO"]?.credit || 0);
  const utilidad = totalIngreso - totalGasto;
  lines.push("\n## Balance General Resumido");
  lines.push(`Total Activo: ${totalActivo.toFixed(2)}`);
  lines.push(`Total Pasivo: ${totalPasivo.toFixed(2)}`);
  lines.push(`Total Patrimonio: ${totalPatrimonio.toFixed(2)}`);
  lines.push(`Utilidad del Ejercicio: ${utilidad.toFixed(2)}`);
  lines.push(`Activo = Pasivo + Patrimonio + Utilidad: ${totalActivo.toFixed(2)} = ${(totalPasivo + totalPatrimonio + utilidad).toFixed(2)}`);

  // 5. Todas las Entradas del Libro Diario
  if (entries.length > 0) {
    lines.push(`\n## Libro Diario Completo (${entries.length} entradas)`);
    entries.forEach((e) => {
      const voidTag = e.void_of ? ` [ANULA: ${e.void_of}]` : "";
      lines.push(`\nFecha: ${e.date} | ID: ${e.id} | Memo: ${e.memo || "-"}${voidTag}`);
      e.lines?.forEach((l: any) => {
        const memo = l.line_memo ? ` (${l.line_memo})` : "";
        lines.push(`  ${accName(l.account_id)}: Débito=${l.debit || 0}, Crédito=${l.credit || 0}${memo}`);
      });
    });
  }

  // 6. Definiciones de Libros Auxiliares
  if (auxiliaryDefinitions.length > 0) {
    lines.push("\n## Definiciones de Libros Auxiliares");
    auxiliaryDefinitions.forEach((d) => {
      lines.push(`${d.name} → Cuenta: ${accName(d.account_id)}`);
    });
  }

  return lines.join("\n");
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function AIAssistantPage() {
  const { accounts, entries, auxiliaryDefinitions } = useAccounting();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const accountingContext = useMemo(
    () => buildAccountingContext(accounts, entries, auxiliaryDefinitions),
    [accounts, entries, auxiliaryDefinitions]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          accountingContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        toast({ title: "Error", description: err.error || `Error ${resp.status}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo conectar con el asistente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <h2 className="text-2xl font-bold mb-4">Asistente IA Contable</h2>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 py-20">
              <Bot className="w-12 h-12" />
              <p className="text-lg font-medium">¿En qué puedo ayudarte?</p>
              <p className="text-sm text-center max-w-md">
                Tengo acceso a tu plan de cuentas, libro diario y balances. Pregúntame
                lo que necesites sobre tu contabilidad.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
