// src/services/backupService.ts
import { supabase } from '@/integrations/supabase/client';

export interface BackupData {
  version: string;
  created_at: string;
  accounts: any[];
  journal_entries: any[];
  journal_lines: any[];
  auxiliary_ledger_definitions: any[];
  auxiliary_ledger: any[];
  auxiliary_movement_details: any[];
  kardex_definitions: any[];
  kardex_entries: any[];
  kardex_movements: any[];
  quarterly_closures: any[];
}

export async function createFullBackup(): Promise<BackupData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // Fetch all data in parallel
  const [
    accountsRes,
    entriesRes,
    linesRes,
    auxDefsRes,
    auxLedgerRes,
    auxMovementsRes,
    kardexDefsRes,
    kardexEntriesRes,
    kardexMovementsRes,
    closuresRes
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('journal_entries').select('*').eq('user_id', user.id),
    supabase.from('journal_lines').select('*, journal_entries!inner(user_id)').eq('journal_entries.user_id', user.id),
    supabase.from('auxiliary_ledger_definitions').select('*').eq('user_id', user.id),
    supabase.from('auxiliary_ledger').select('*').eq('user_id', user.id),
    supabase.from('auxiliary_movement_details').select('*').eq('user_id', user.id),
    supabase.from('kardex_definitions').select('*').eq('user_id', user.id),
    supabase.from('kardex_entries').select('*').eq('user_id', user.id),
    supabase.from('kardex_movements').select('*').eq('user_id', user.id),
    supabase.from('quarterly_closures').select('*').eq('user_id', user.id),
  ]);

  // Clean lines data (remove join artifact)
  const cleanLines = (linesRes.data || []).map(({ journal_entries, ...line }) => line);

  return {
    version: '1.0',
    created_at: new Date().toISOString(),
    accounts: accountsRes.data || [],
    journal_entries: entriesRes.data || [],
    journal_lines: cleanLines,
    auxiliary_ledger_definitions: auxDefsRes.data || [],
    auxiliary_ledger: auxLedgerRes.data || [],
    auxiliary_movement_details: auxMovementsRes.data || [],
    kardex_definitions: kardexDefsRes.data || [],
    kardex_entries: kardexEntriesRes.data || [],
    kardex_movements: kardexMovementsRes.data || [],
    quarterly_closures: closuresRes.data || [],
  };
}

export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-contabilidad-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreFromBackup(backup: BackupData): Promise<{ success: boolean; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  try {
    // Delete existing data in reverse order of dependencies
    await supabase.from('auxiliary_movement_details').delete().eq('user_id', user.id);
    await supabase.from('auxiliary_ledger').delete().eq('user_id', user.id);
    await supabase.from('auxiliary_ledger_definitions').delete().eq('user_id', user.id);
    await supabase.from('kardex_movements').delete().eq('user_id', user.id);
    await supabase.from('kardex_entries').delete().eq('user_id', user.id);
    await supabase.from('kardex_definitions').delete().eq('user_id', user.id);
    await supabase.from('quarterly_closures').delete().eq('user_id', user.id);
    await supabase.from('journal_entries').delete().eq('user_id', user.id);
    await supabase.from('accounts').delete().eq('user_id', user.id);

    // Insert new data with correct user_id
    if (backup.accounts.length > 0) {
      const accounts = backup.accounts.map(a => ({ ...a, user_id: user.id }));
      const { error } = await supabase.from('accounts').insert(accounts);
      if (error) throw error;
    }

    if (backup.journal_entries.length > 0) {
      const entries = backup.journal_entries.map(e => ({ ...e, user_id: user.id }));
      const { error } = await supabase.from('journal_entries').insert(entries);
      if (error) throw error;
    }

    if (backup.journal_lines.length > 0) {
      const { error } = await supabase.from('journal_lines').insert(backup.journal_lines);
      if (error) throw error;
    }

    if (backup.auxiliary_ledger_definitions.length > 0) {
      const defs = backup.auxiliary_ledger_definitions.map(d => ({ ...d, user_id: user.id }));
      const { error } = await supabase.from('auxiliary_ledger_definitions').insert(defs);
      if (error) throw error;
    }

    if (backup.auxiliary_ledger.length > 0) {
      const ledger = backup.auxiliary_ledger.map(l => ({ ...l, user_id: user.id }));
      const { error } = await supabase.from('auxiliary_ledger').insert(ledger);
      if (error) throw error;
    }

    if (backup.auxiliary_movement_details.length > 0) {
      const movements = backup.auxiliary_movement_details.map(m => ({ ...m, user_id: user.id }));
      const { error } = await supabase.from('auxiliary_movement_details').insert(movements);
      if (error) throw error;
    }

    if (backup.kardex_definitions.length > 0) {
      const defs = backup.kardex_definitions.map(d => ({ ...d, user_id: user.id }));
      const { error } = await supabase.from('kardex_definitions').insert(defs);
      if (error) throw error;
    }

    if (backup.kardex_entries.length > 0) {
      const entries = backup.kardex_entries.map(e => ({ ...e, user_id: user.id }));
      const { error } = await supabase.from('kardex_entries').insert(entries);
      if (error) throw error;
    }

    if (backup.kardex_movements.length > 0) {
      const movements = backup.kardex_movements.map(m => ({ ...m, user_id: user.id }));
      const { error } = await supabase.from('kardex_movements').insert(movements);
      if (error) throw error;
    }

    if (backup.quarterly_closures.length > 0) {
      const closures = backup.quarterly_closures.map(c => ({ ...c, user_id: user.id }));
      const { error } = await supabase.from('quarterly_closures').insert(closures);
      if (error) throw error;
    }

    return { 
      success: true, 
      message: `Restauración completada: ${backup.accounts.length} cuentas, ${backup.journal_entries.length} asientos` 
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: `Error en restauración: ${error.message}` 
    };
  }
}

export function validateBackupFile(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Archivo no es un JSON válido' };
  }

  if (!data.version) {
    return { valid: false, error: 'Archivo no tiene versión de backup' };
  }

  const requiredArrays = [
    'accounts',
    'journal_entries',
    'journal_lines'
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      return { valid: false, error: `Falta o es inválido el campo: ${key}` };
    }
  }

  return { valid: true };
}
