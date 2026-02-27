// src/components/journal/AIJournalAssistant.tsx
// Componente de asistente IA para generación de asientos contables

import React, { useState, useRef } from 'react';
import { Sparkles, Send, ChevronDown, ChevronUp, Check, X, RotateCcw, Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Account } from '@/accounting/types';
import { fmt } from '@/accounting/utils';
import { generateJournalEntries, AIJournalSuggestion, AIParseResult } from '@/services/aiService';
import { toast } from 'sonner';

interface AIJournalAssistantProps {
  accounts: Account[];
  onApplySuggestion: (suggestion: AIJournalSuggestion) => void;
}

const EXAMPLE_PROMPTS = [
  'Ayer gasté Bs. 20 en pasajes',
  'Hoy compré una TAB S10 FE por Bs. 1245',
  'Recibí Bs. 5000 por ventas del día, cobrado en banco',
  'Pagué Bs. 350 de internet y Bs. 120 de electricidad',
];

export function AIJournalAssistant({ accounts, onApplySuggestion }: AIJournalAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIParseResult | null>(null);
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleGenerate() {
    if (!inputText.trim()) {
      toast.error('Escribe una o más transacciones para generar los asientos');
      return;
    }
    setIsLoading(true);
    setResult(null);
    setAppliedIndexes(new Set());
    try {
      const parsed = await generateJournalEntries(inputText, accounts);
      setResult(parsed);
      if (parsed.suggestions.length === 0) {
        toast.warning('No se pudieron generar asientos. Intenta con más detalle.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al procesar con IA');
    } finally {
      setIsLoading(false);
    }
  }

  function handleApply(suggestion: AIJournalSuggestion, index: number) {
    onApplySuggestion(suggestion);
    setAppliedIndexes(prev => new Set([...prev, index]));
    toast.success(`Asiento "${suggestion.memo}" cargado en el formulario`);
  }

  function handleReset() {
    setResult(null);
    setInputText('');
    setAppliedIndexes(new Set());
  }

  function handleExampleClick(example: string) {
    setInputText(prev => prev ? `${prev}\n${example}` : example);
    textareaRef.current?.focus();
  }

  // Determine side label color
  function getSideLabelClass(label: string) {
    if (label.endsWith('+')) {
      if (label.startsWith('A') || label.startsWith('G')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    }
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
  }

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/80 to-purple-50/40 dark:from-violet-950/30 dark:to-purple-950/20 shadow-sm overflow-hidden">
      {/* Header / toggle */}
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-violet-900 dark:text-violet-100 text-sm">
            Asistente IA — Generar asientos desde texto
          </span>
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0 text-[10px] font-semibold uppercase tracking-wide">
            Beta
          </Badge>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-violet-400" />
          : <ChevronDown className="w-4 h-4 text-violet-400" />
        }
      </button>

      {/* Body */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-violet-200/60 dark:border-violet-800/40">

          {/* Input area */}
          {!result && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-violet-700 dark:text-violet-300">
                  Describe tus transacciones en lenguaje natural
                </label>
                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={"Ayer gasté Bs. 20 en pasajes\nHoy compré una impresora por Bs. 850 con banco"}
                  rows={3}
                  className="resize-none text-sm bg-white dark:bg-gray-900 border-violet-200 dark:border-violet-700 focus-visible:ring-violet-400 placeholder:text-gray-400"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Puedes escribir varias transacciones, una por línea. Presiona Ctrl+Enter para generar.
                </p>
              </div>

              {/* Example chips */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lightbulb className="w-3 h-3" />
                  Ejemplos:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(ex)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isLoading || !inputText.trim()}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-sm"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</>
                  : <><Send className="w-4 h-4 mr-2" />Generar asientos</>
                }
              </Button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Interpretation badge */}
              {result.raw_interpretation && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-violet-300 pl-3">
                  {result.raw_interpretation}
                </p>
              )}

              {/* Suggestion cards */}
              {result.suggestions.map((suggestion, idx) => {
                const isApplied = appliedIndexes.has(idx);
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border transition-all ${
                      isApplied
                        ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{suggestion.date}</span>
                          {isApplied && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px]">
                              <Check className="w-3 h-3 mr-1" />Aplicado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">
                          {suggestion.memo}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isApplied ? "outline" : "default"}
                        disabled={isApplied}
                        onClick={() => handleApply(suggestion, idx)}
                        className={!isApplied ? "bg-violet-600 hover:bg-violet-700 text-white border-0 text-xs h-8" : "text-xs h-8"}
                      >
                        {isApplied
                          ? <><Check className="w-3.5 h-3.5 mr-1" />Aplicado</>
                          : <>Usar este asiento</>
                        }
                      </Button>
                    </div>

                    {/* Lines */}
                    <div className="px-4 py-2.5 space-y-1.5">
                      {suggestion.lines.map((line, lineIdx) => (
                        <div key={lineIdx} className="flex items-center gap-3 text-sm">
                          <Badge
                            className={`text-[10px] font-bold min-w-[28px] justify-center ${getSideLabelClass(line.side_label)}`}
                          >
                            {line.side_label}
                          </Badge>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            {line.account_name}
                            <span className="text-muted-foreground font-mono ml-1 text-[11px]">
                              ({line.account_id})
                            </span>
                          </span>
                          <div className="font-mono text-xs flex gap-3 min-w-[140px] justify-end">
                            <span className={line.debit > 0 ? 'text-gray-800 dark:text-gray-200 font-semibold' : 'text-muted-foreground/40'}>
                              {line.debit > 0 ? `Bs. ${fmt(line.debit)}` : '—'}
                            </span>
                            <span className={line.credit > 0 ? 'text-gray-800 dark:text-gray-200 font-semibold' : 'text-muted-foreground/40'}>
                              {line.credit > 0 ? `Bs. ${fmt(line.credit)}` : '—'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Totals row */}
                      <div className="flex items-center gap-3 text-xs border-t border-dashed border-gray-200 dark:border-gray-700 pt-1.5 mt-1">
                        <span className="flex-1 text-right text-muted-foreground font-medium">Totales</span>
                        <div className="font-mono flex gap-3 min-w-[140px] justify-end text-muted-foreground">
                          <span>Bs. {fmt(suggestion.lines.reduce((s, l) => s + l.debit, 0))}</span>
                          <span>Bs. {fmt(suggestion.lines.reduce((s, l) => s + l.credit, 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    {suggestion.explanation && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[11px] text-muted-foreground italic">
                          💡 {suggestion.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Reset */}
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Nueva consulta
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
