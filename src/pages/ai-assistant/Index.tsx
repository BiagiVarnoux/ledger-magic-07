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

  // Accounts summary
  lines.push("## Plan de Cuentas");
  lines.push("Código | Nombre | Tipo | Saldo Normal | Categoría Gasto | Activa");
  accounts.forEach((a) => {
    lines.push(
      `${a.id} | ${a.name} | ${a.type} | ${a.normalSide} | ${a.expenseCategory || "-"} | ${a.isActive ? "Sí" : "No"}`
    );
  });

  // Totals by type
  const typeTotals: Record<string, { debit: number; credit: number }> = {};
  entries.forEach((e) => {
    e.lines?.forEach((l: any) => {
      const acc = accounts.find((a) => a.id === l.accountId);
      if (acc) {
        if (!typeTotals[acc.type]) typeTotals[acc.type] = { debit: 0, credit: 0 };
        typeTotals[acc.type].debit += l.debit || 0;
        typeTotals[acc.type].credit += l.credit || 0;
      }
    });
  });
  lines.push("\n## Totales por Tipo de Cuenta");
  Object.entries(typeTotals).forEach(([type, t]) => {
    lines.push(`${type}: Débitos=${t.debit.toFixed(2)}, Créditos=${t.credit.toFixed(2)}`);
  });

  // Recent entries (last 20)
  const recent = entries.slice(-20);
  if (recent.length > 0) {
    lines.push("\n## Últimas 20 Entradas del Libro Diario");
    recent.forEach((e) => {
      lines.push(`\nFecha: ${e.date} | ID: ${e.id} | Memo: ${e.memo || "-"}`);
      e.lines?.forEach((l: any) => {
        lines.push(`  ${l.accountId}: Débito=${l.debit || 0}, Crédito=${l.credit || 0}`);
      });
    });
  }

  // Auxiliary definitions
  if (auxiliaryDefinitions.length > 0) {
    lines.push("\n## Definiciones de Libros Auxiliares");
    auxiliaryDefinitions.forEach((d) => {
      lines.push(`${d.name} → Cuenta: ${d.accountId}`);
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
