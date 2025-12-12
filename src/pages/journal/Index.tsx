// src/pages/journal/Index.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { useAccounting } from '@/accounting/AccountingProvider';
import { useUserAccess } from '@/contexts/UserAccessContext';
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner';
import { JournalEntry } from '@/accounting/types';
import { generateEntryId } from '@/accounting/utils';
import { getCurrentQuarter, getAllQuartersFromStart, parseQuarterString, isDateInQuarter } from '@/accounting/quarterly-utils';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentKardexState } from '@/accounting/kardex-utils';
import { exportJournalToCSV } from '@/services/exportService';

// Components
import { JournalEntryForm } from '@/components/journal/JournalEntryForm';
import { JournalEntriesTable } from '@/components/journal/JournalEntriesTable';
import { InlineKardexPopup, KardexData } from '@/components/kardex/InlineKardexPopup';
import { AuxiliaryLedgerModal } from '@/components/auxiliary-ledger/AuxiliaryLedgerModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Hook
import { useJournalForm, LineDraft } from '@/hooks/useJournalForm';

export default function JournalPage() {
  const { accounts, entries, setEntries, adapter, auxiliaryDefinitions, kardexDefinitions } = useAccounting();
  const { isReadOnly } = useUserAccess();
  
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter().label);
  const [showLineMemos, setShowLineMemos] = useState<boolean>(() => {
    return localStorage.getItem('journal-show-line-memos') === 'true';
  });
  const [kardexPopupState, setKardexPopupState] = useState<{
    isOpen: boolean;
    lineIndex: number;
    accountId: string;
    lineAmount?: number;
  } | null>(null);
  const [auxiliaryModalState, setAuxiliaryModalState] = useState<{
    isOpen: boolean;
    linesToProcess: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }>;
    originalEntry: JournalEntry | null;
  }>({
    isOpen: false,
    linesToProcess: [],
    originalEntry: null
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  // Use custom hook for form management
  const form = useJournalForm({
    accounts,
    entries,
    kardexDefinitions,
    onKardexPopupOpen: (lineIndex, accountId, lineAmount) => {
      setKardexPopupState({
        isOpen: true,
        lineIndex,
        accountId,
        lineAmount
      });
    }
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

  function handleKardexPopupSave(kardexData: KardexData) {
    if (!kardexPopupState) return;
    form.handleKardexPopupSave(kardexData, kardexPopupState.lineIndex);
    setKardexPopupState(null);
  }

  function detectAuxiliaryLines(je: JournalEntry): Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> {
    const auxiliaryLines: Array<{ lineDraft: LineDraft; lineIndex: number; accountId: string; lineAmount: number; isIncrease: boolean }> = [];
    
    const auxiliaryAccountIds = auxiliaryDefinitions.map(d => d.account_id);
    
    je.lines.forEach((line, index) => {
      if (auxiliaryAccountIds.includes(line.account_id)) {
        const lineDraft = form.lines[index];
        const lineAmount = line.debit || line.credit;
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

  async function saveEntry() {
    const je = form.validateAndBuildEntry();
    if (!je) return;
    
    const auxiliaryLines = detectAuxiliaryLines(je);
    
    if (auxiliaryLines.length > 0) {
      setAuxiliaryModalState({
        isOpen: true,
        linesToProcess: auxiliaryLines,
        originalEntry: je
      });
      return;
    }
    
    await handleFinalSave(je);
  }

  async function handleAuxiliarySave(je: JournalEntry) {
    await handleFinalSave(je);
  }

  async function handleFinalSave(je: JournalEntry) {
    try {
      await adapter.saveEntry(je);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (let i = 0; i < form.lines.length; i++) {
          const line = form.lines[i];
          if (line.kardexData && line.account_id) {
            const kardexDef = kardexDefinitions.find(d => d.account_id === line.account_id);
            if (!kardexDef) continue;
            
            const { data: existingKardex, error: kardexError } = await supabase
              .from('kardex_entries')
              .select('id')
              .eq('account_id', line.account_id)
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (kardexError) throw kardexError;
            
            let kardexId = existingKardex?.id;
            
            if (!kardexId) {
              const { data: newKardex, error: createError } = await supabase
                .from('kardex_entries')
                .insert({
                  account_id: line.account_id,
                  user_id: user.id
                })
                .select()
                .single();
              
              if (createError) throw createError;
              kardexId = newKardex.id;
            }
            
            const { data: allMovements } = await supabase
              .from('kardex_movements')
              .select('*')
              .eq('kardex_id', kardexId)
              .eq('user_id', user.id)
              .order('fecha', { ascending: true })
              .order('created_at', { ascending: true });
            
            const currentState = getCurrentKardexState(allMovements || []);
            
            let nuevoSaldo = 0;
            let nuevoCostoUnitario = 0;
            let nuevoSaldoValorado = 0;
            
            const entrada = Number(line.kardexData.entrada);
            const salida = Number(line.kardexData.salidas);
            const costoTotal = Number(line.kardexData.costo_total);
            
            if (entrada > 0) {
              nuevoSaldo = currentState.currentBalance + entrada;
              nuevoSaldoValorado = currentState.currentValuedBalance + costoTotal;
              nuevoCostoUnitario = nuevoSaldo > 0 ? nuevoSaldoValorado / nuevoSaldo : 0;
            } else if (salida > 0) {
              nuevoSaldo = currentState.currentBalance - salida;
              nuevoCostoUnitario = currentState.currentUnitCost;
              nuevoSaldoValorado = nuevoSaldo * nuevoCostoUnitario;
            }
            
            const { error: movError } = await supabase
              .from('kardex_movements')
              .insert({
                kardex_id: kardexId,
                user_id: user.id,
                fecha: je.date,
                concepto: line.kardexData.concepto,
                entrada: entrada,
                salidas: salida,
                costo_total: costoTotal,
                journal_entry_id: je.id,
                saldo: nuevoSaldo,
                costo_unitario: nuevoCostoUnitario,
                saldo_valorado: nuevoSaldoValorado
              });
            
            if (movError) throw movError;
          }
        }
      }
      
      setEntries(await adapter.loadEntries());
      toast.success(`Asiento ${je.id} ${form.editingEntry ? 'actualizado' : 'guardado'}`);
      form.clearForm();
    } catch (e: any) {
      toast.error(e.message || 'Error guardando asiento');
    }
  }

  const handleDeleteClick = (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    try {
      await adapter.deleteEntry(entryToDelete);
      setEntries(await adapter.loadEntries());
      toast.success('Asiento eliminado');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo eliminar asiento');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  async function voidEntry(orig: JournalEntry) {
    const inv: JournalEntry = {
      id: generateEntryId(orig.date, entries),
      date: orig.date,
      memo: (orig.memo ? `${orig.memo} ` : '') + '(ANULACIÓN)',
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
    } catch (e: any) {
      toast.error(e.message || 'No se pudo anular');
    }
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Libro Diario</h1>
        <Button variant="outline" onClick={() => exportJournalToCSV(entries)}>
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

      {/* Form - Only show for owners */}
      {!isReadOnly && (
        <JournalEntryForm
          date={form.date}
          onDateChange={form.setDate}
          memo={form.memo}
          onMemoChange={form.setMemo}
          lines={form.lines}
          accounts={accounts}
          editingEntry={form.editingEntry}
          showLineMemos={showLineMemos}
          onToggleLineMemos={() => setShowLineMemos(!showLineMemos)}
          totals={form.totals}
          onAddLine={form.addLine}
          onAccountChange={form.handleAccountChange}
          onLineChange={form.setLine}
          onRemoveLine={form.removeLine}
          onSave={saveEntry}
          onClear={form.clearForm}
        />
      )}

      <JournalEntriesTable
        entries={filteredEntries}
        accounts={accounts}
        isReadOnly={isReadOnly}
        sortOrder={sortOrder}
        selectedQuarter={selectedQuarter}
        onSortOrderChange={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        onEdit={form.editEntry}
        onVoid={voidEntry}
        onDelete={handleDeleteClick}
      />

      {kardexPopupState && (
        <InlineKardexPopup
          isOpen={kardexPopupState.isOpen}
          onClose={() => setKardexPopupState(null)}
          accountId={kardexPopupState.accountId}
          lineAmount={kardexPopupState.lineAmount}
          onSave={handleKardexPopupSave}
          initialData={form.lines[kardexPopupState.lineIndex]?.kardexData}
        />
      )}

      <AuxiliaryLedgerModal
        isOpen={auxiliaryModalState.isOpen}
        onClose={() => setAuxiliaryModalState({ ...auxiliaryModalState, isOpen: false })}
        linesToProcess={auxiliaryModalState.linesToProcess}
        originalEntry={auxiliaryModalState.originalEntry}
        onSave={handleAuxiliarySave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El asiento será eliminado permanentemente.
              Si este asiento tiene movimientos auxiliares o de kardex asociados, también serán eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
