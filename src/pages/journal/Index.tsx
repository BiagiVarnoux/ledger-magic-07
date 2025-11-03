// src/pages/journal/Index.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Undo2, Trash2, Save, Plus, Download, Pencil, ArrowUpDown, Eye, EyeOff, Users } from 'lucide-react';
import { AuxiliaryLedgerModal } from '@/components/auxiliary-ledger/AuxiliaryLedgerModal';
import { KardexModal } from '@/components/kardex/KardexModal';
import { toast } from 'sonner';
import { useAccounting } from '@/accounting/AccountingProvider';
import { JournalEntry, JournalLine } from '@/accounting/types';
import { 
  todayISO, 
  toDecimal, 
  formatDecimal,
  generateEntryId, 
  cmpDate, 
  fmt,
  TYPE_ABBR,
  signForLine
} from '@/accounting/utils';
import { getCurrentQuarter, getAllQuartersFromStart, parseQuarterString, isDateInQuarter } from '@/accounting/quarterly-utils';

type LineDraft = { 
  account_id?: string; 
  debit?: string; 
  credit?: string; 
  line_memo?: string; 
};

export default function JournalPage() {
  const { accounts, entries, setEntries, adapter, auxiliaryDefinitions, kardexDefinitions } = useAccounting();
  const [date, setDate] = useState<string>(todayISO());
  const [memo, setMemo] = useState<string>("");
  const [lines, setLines] = useState<LineDraft[]>([{}, {}, {}]);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter().label);
  const [showLineMemos, setShowLineMemos] = useState<boolean>(() => {
    return localStorage.getItem('journal-show-line-memos') === 'true';
  });
  const [kardexModalState, setKardexModalState] = useState<{
    isOpen: boolean;
    linesToProcess: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }>;
    originalEntry: JournalEntry | null;
  }>({
    isOpen: false,
    linesToProcess: [],
    originalEntry: null
  });
  const [auxiliaryModalState, setAuxiliaryModalState] = useState<{
    isOpen: boolean;
    linesToProcess: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }>;
    originalEntry: JournalEntry | null;
  }>({
    isOpen: false,
    linesToProcess: [],
    originalEntry: null
  });

  // Filter entries by selected quarter
  const currentQuarter = useMemo(() => parseQuarterString(selectedQuarter), [selectedQuarter]);
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => isDateInQuarter(entry.date, currentQuarter));
  }, [entries, currentQuarter]);

  // Available quarters for selection
  const availableQuarters = useMemo(() => getAllQuartersFromStart(2020), []);

  useEffect(() => {
    localStorage.setItem('journal-show-line-memos', showLineMemos.toString());
  }, [showLineMemos]);

  function addLine() { 
    setLines(ls => [...ls, {}]); 
  }
  
  function setLine(idx: number, patch: Partial<LineDraft>) { 
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l)); 
  }
  
  function removeLine(idx: number) { 
    setLines(ls => ls.filter((_, i) => i !== idx)); 
  }

  function detectKardexLines(je: JournalEntry): Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> {
    const kardexLines: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> = [];
    
    // Get all kardex account IDs from definitions
    const kardexAccountIds = kardexDefinitions.map(d => d.account_id);
    
    je.lines.forEach((line, index) => {
      if (kardexAccountIds.includes(line.account_id)) {
        const lineDraft = lines[index];
        const lineAmount = line.debit || line.credit;
        const account = accounts.find(a => a.id === line.account_id);
        const isIncrease = account?.normal_side === 'DEBE' ? line.debit > 0 : line.credit > 0;
        
        kardexLines.push({
          lineDraft,
          lineIndex: index,
          accountId: line.account_id,
          lineAmount,
          isIncrease
        });
      }
    });
    
    return kardexLines;
  }

  function detectAuxiliaryLines(je: JournalEntry): Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> {
    const auxiliaryLines: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> = [];
    
    // Get all auxiliary account IDs from definitions
    const auxiliaryAccountIds = auxiliaryDefinitions.map(d => d.account_id);
    
    je.lines.forEach((line, index) => {
      if (auxiliaryAccountIds.includes(line.account_id)) {
        const lineDraft = lines[index];
        const lineAmount = line.debit || line.credit;
        // Determinar si es aumento o disminución según el tipo de cuenta y el lado
        const account = accounts.find(a => a.id === line.account_id);
        const isIncrease = account?.normal_side === 'DEBE' ? line.debit > 0 : line.credit > 0;
        
        auxiliaryLines.push({
          lineDraft,
          lineIndex: index,
          accountId: line.account_id,
          lineAmount,
          isIncrease
        });
      }
    });
    
    return auxiliaryLines;
  }

  const totals = useMemo(() => {
    let d = 0, c = 0;
    for (const l of lines) {
      const dv = toDecimal(l.debit);
      const cv = toDecimal(l.credit);
      d += dv; c += cv;
    }
    return { debit: d, credit: c, diff: +(d - c).toFixed(2) };
  }, [lines]);

  function validateAndBuildEntry(): JournalEntry | null {
    const clean: JournalLine[] = [];
    for (const l of lines) {
      const acc = l.account_id?.trim(); 
      const d = toDecimal(l.debit); 
      const c = toDecimal(l.credit);
      if (!acc && d === 0 && c === 0) continue;
      if (!acc) { toast.error("Línea sin cuenta"); return null; }
      const accExists = accounts.find(a => a.id === acc && a.is_active);
      if (!accExists) { toast.error(`Cuenta ${acc} no existe o está inactiva`); return null; }
      if (d > 0 && c > 0) { toast.error("Una línea no puede tener Debe y Haber a la vez"); return null; }
      if (d === 0 && c === 0) { toast.error("Línea sin importe"); return null; }
      clean.push({ account_id: acc, debit: d, credit: c, line_memo: l.line_memo?.trim() });
    }
    if (clean.length < 2) { toast.error("El asiento necesita al menos 2 líneas"); return null; }
    const sumD = clean.reduce((s, l) => s + l.debit, 0); 
    const sumC = clean.reduce((s, l) => s + l.credit, 0);
    if (+sumD.toFixed(2) !== +sumC.toFixed(2)) { toast.error("El asiento no cuadra (Debe ≠ Haber)"); return null; }
    const id = editingEntry ? editingEntry.id : generateEntryId(date, entries);
    return { id, date, memo: memo.trim() || undefined, lines: clean };
  }

  async function saveEntry() {
    const je = validateAndBuildEntry(); 
    if (!je) return;
    
    // Detectar líneas que requieren kárdex (PRIMERO)
    const kardexLines = detectKardexLines(je);
    
    if (kardexLines.length > 0) {
      // Hay líneas de kárdex, abrir el modal de kárdex
      setKardexModalState({
        isOpen: true,
        linesToProcess: kardexLines,
        originalEntry: je
      });
      return;
    }
    
    // Detectar líneas que requieren gestión auxiliar (SEGUNDO)
    const auxiliaryLines = detectAuxiliaryLines(je);
    
    if (auxiliaryLines.length > 0) {
      // Hay líneas auxiliares, abrir el modal
      setAuxiliaryModalState({
        isOpen: true,
        linesToProcess: auxiliaryLines,
        originalEntry: je
      });
      return;
    }
    
    // No hay líneas especiales, guardar directamente
    await handleFinalSave(je);
  }

  async function handleKardexSave(je: JournalEntry) {
    // Después de guardar kárdex, verificar si hay auxiliares
    const auxiliaryLines = detectAuxiliaryLines(je);
    
    if (auxiliaryLines.length > 0) {
      // Hay líneas auxiliares, abrir el modal de auxiliares
      setAuxiliaryModalState({
        isOpen: true,
        linesToProcess: auxiliaryLines,
        originalEntry: je
      });
    } else {
      // No hay auxiliares, guardar directamente
      await handleFinalSave(je);
    }
  }

  async function handleAuxiliarySave(je: JournalEntry) {
    await handleFinalSave(je);
  }

  async function handleFinalSave(je: JournalEntry) {
    try { 
      await adapter.saveEntry(je); 
      setEntries(await adapter.loadEntries()); 
      toast.success(`Asiento ${je.id} ${editingEntry ? 'actualizado' : 'guardado'}`); 
      clearForm();
    }
    catch(e: any) { 
      toast.error(e.message || "Error guardando asiento"); 
    }
  }

  function clearForm() {
    setMemo(""); 
    setLines([{}, {}, {}]); 
    setEditingEntry(null);
  }

  function editEntry(entry: JournalEntry) {
    if (entry.void_of) {
      toast.error("No se puede editar un asiento de anulación");
      return;
    }
    setDate(entry.date);
    setMemo(entry.memo || "");
    setLines(entry.lines.map(l => ({
      account_id: l.account_id,
      debit: formatDecimal(l.debit),
      credit: formatDecimal(l.credit),
      line_memo: l.line_memo
    })));
    setEditingEntry(entry);
  }

  async function deleteEntry(id: string) { 
    try { 
      await adapter.deleteEntry(id); 
      setEntries(await adapter.loadEntries()); 
      toast.success("Asiento eliminado"); 
    } catch(e: any) { 
      toast.error(e.message || "No se pudo eliminar asiento"); 
    } 
  }

  async function voidEntry(orig: JournalEntry) {
    const inv: JournalEntry = { 
      id: generateEntryId(orig.date, entries), 
      date: orig.date, 
      memo: (orig.memo ? `${orig.memo} ` : "") + "(ANULACIÓN)", 
      void_of: orig.id, 
      lines: orig.lines.map(l => ({ 
        account_id: l.account_id, 
        debit: l.credit, 
        credit: l.debit, 
        line_memo: l.line_memo 
      })) 
    };
    try { 
      await adapter.saveEntry(inv); 
      setEntries(await adapter.loadEntries()); 
      toast.success(`Asiento ${orig.id} anulado con ${inv.id}`); 
    } catch(e: any) { 
      toast.error(e.message || "No se pudo anular"); 
    }
  }

  function exportJournal() {
    const rows = [["ID", "Fecha", "Glosa", "Cuenta", "Debe", "Haber", "Glosa línea"]];
    for (const e of entries) { 
      for (const l of e.lines) { 
        rows.push([
          e.id, 
          e.date, 
          e.memo || "", 
          l.account_id, 
          String(l.debit), 
          String(l.credit), 
          l.line_memo || ""
        ]); 
      } 
    }
    const csv = rows.map(r => r.map(x => `"${(x ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = "libro_diario.csv"; 
    a.click(); 
    URL.revokeObjectURL(url);
  }

  // Helper para mostrar etiqueta con abreviación y signo
  function AccountLabel({ accountId, line }: { accountId: string; line?: { debit?: string | number; credit?: string | number } }) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return <span className="text-muted-foreground">--</span>;
    
    const abbr = TYPE_ABBR[account.type];
    const sign = line ? signForLine(account, line) : "";
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {abbr}
              {sign && <span className={sign === "+" ? "text-green-600" : "text-red-600"}>{sign}</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{accountId}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro Diario</h1>
        <Button variant="outline" onClick={exportJournal}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Diario
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Label htmlFor="quarter-select">Trimestre:</Label>
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccionar trimestre" />
              </SelectTrigger>
              <SelectContent>
                {availableQuarters.map((quarter) => (
                  <SelectItem key={`${quarter.year}-Q${quarter.quarter}`} value={quarter.label}>
                    {quarter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{editingEntry ? `Editando Asiento ${editingEntry.id}` : "Nuevo Asiento"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-6 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="col-span-5">
              <Label>Glosa</Label>
              <Input 
                value={memo} 
                onChange={e => setMemo(e.target.value)} 
                placeholder="Descripción del asiento" 
              />
            </div>
          </div>

          <div className="border rounded-xl">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-[250px]">Cuenta</TableHead>
                   <TableHead className="w-[200px]">Debe</TableHead>
                   <TableHead className="w-[200px]">Haber</TableHead>
                   {showLineMemos && <TableHead>Glosa línea</TableHead>}
                   <TableHead className="text-right">
                     <Button size="sm" variant="outline" onClick={addLine}>
                       <Plus className="w-4 h-4" />
                     </Button>
                   </TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         <Select 
                           value={l.account_id || ""} 
                           onValueChange={(v) => setLine(idx, { account_id: v })}
                         >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona cuenta" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {accounts.filter(a => a.is_active).map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.id} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                         {l.account_id && <AccountLabel accountId={l.account_id} line={l} />}
                      </div>
                    </TableCell>
                     <TableCell>
                       <Input 
                         type="text" 
                         value={l.debit || ""} 
                         onChange={e => setLine(idx, { debit: e.target.value, credit: "" })} 
                         placeholder="0,00"
                       />
                     </TableCell>
                     <TableCell>
                       <Input 
                         type="text" 
                         value={l.credit || ""} 
                         onChange={e => setLine(idx, { credit: e.target.value, debit: "" })} 
                         placeholder="0,00"
                       />
                     </TableCell>
                     {showLineMemos && (
                       <TableCell>
                         <Input 
                           value={l.line_memo || ""} 
                           onChange={e => setLine(idx, { line_memo: e.target.value })} 
                         />
                       </TableCell>
                     )}
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => removeLine(idx)} 
                        title="Eliminar fila"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                 <TableRow>
                   <TableCell className="text-right font-medium">Totales</TableCell>
                   <TableCell className="font-semibold">{fmt(totals.debit)}</TableCell>
                   <TableCell className="font-semibold">{fmt(totals.credit)}</TableCell>
                   <TableCell colSpan={showLineMemos ? 2 : 1} className={"text-right font-semibold " + (totals.diff === 0 ? "text-green-600" : "text-red-600")}>
                     {totals.diff === 0 ? "Cuadra" : `Diferencia: ${fmt(totals.diff)}`}
                   </TableCell>
                 </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveEntry}>
              <Save className="w-4 h-4 mr-2" />
              {editingEntry ? "Actualizar asiento" : "Guardar asiento"}
            </Button>
            <Button variant="outline" onClick={clearForm}>
              {editingEntry ? "Cancelar edición" : "Limpiar"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowLineMemos(!showLineMemos)}
            >
              {showLineMemos ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showLineMemos ? 'Ocultar glosas en línea' : 'Mostrar glosas en línea'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Asientos registrados</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortOrder === 'asc' ? 'Más antiguo' : 'Más reciente'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Glosa</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay asientos registrados para {selectedQuarter}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.sort((a, b) => sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)).map(e => (
                  <React.Fragment key={e.id}>
                    <TableRow>
                      <TableCell className="font-mono">{e.id}</TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                           {e.lines.map((l, i) => {
                             const a = accounts.find(x => x.id === l.account_id);
                             return (
                               <div key={i} className="flex gap-2 items-center">
                                 <AccountLabel accountId={l.account_id} line={l} />
                                 <span className="flex-1">{a?.name}</span>
                                 <span className="w-24 text-right">{l.debit ? fmt(l.debit) : ""}</span>
                                 <span className="w-24 text-right">{l.credit ? fmt(l.credit) : ""}</span>
                               </div>
                             );
                           })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => editEntry(e)} 
                          title="Editar"
                          disabled={!!e.void_of}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => voidEntry(e)} 
                          title="Anular"
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteEntry(e.id)} 
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {e.memo && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground italic text-sm pl-8">
                          {e.memo}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <KardexModal
        isOpen={kardexModalState.isOpen}
        onClose={() => setKardexModalState({ ...kardexModalState, isOpen: false })}
        linesToProcess={kardexModalState.linesToProcess}
        originalEntry={kardexModalState.originalEntry}
        onSave={handleKardexSave}
      />

      <AuxiliaryLedgerModal
        isOpen={auxiliaryModalState.isOpen}
        onClose={() => setAuxiliaryModalState({ ...auxiliaryModalState, isOpen: false })}
        linesToProcess={auxiliaryModalState.linesToProcess}
        originalEntry={auxiliaryModalState.originalEntry}
        onSave={handleAuxiliarySave}
      />
    </div>
  );
}