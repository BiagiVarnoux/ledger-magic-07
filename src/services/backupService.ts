// src/services/backupService.ts
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/accounting/data-adapter';

/** Paginated SELECT * WHERE user_id = ? to bypass PostgREST 1000-row default limit. */
async function fetchAllUserRows(table: string, userId: string): Promise<any[]> {
  return await fetchAllPaginated<any>((from, to) =>
    supabase.from(table as any).select('*').eq('user_id', userId).range(from, to)
  );
}

/** Paginated journal_lines via inner join on journal_entries.user_id. */
async function fetchAllJournalLines(userId: string): Promise<any[]> {
  const rows = await fetchAllPaginated<any>((from, to) =>
    supabase.from('journal_lines')
      .select('*, journal_entries!inner(user_id)')
      .eq('journal_entries.user_id', userId)
      .range(from, to)
  );
  return rows.map(({ journal_entries, ...line }: any) => line);
}

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
  // v2.0 fields (optional for backward compat)
  products?: any[];
  inventory_movements?: any[];
  inventory_lots?: any[];
  import_lots?: any[];
  cost_sheets?: any[];
  cost_sheet_cells?: any[];
  report_settings?: any[];
  shipments?: any[];
}

export async function createFullBackup(): Promise<BackupData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

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
    closuresRes,
    productsRes,
    invMovementsRes,
    invLotsRes,
    importLotsRes,
    costSheetsRes,
    costCellsRes,
    reportSettingsRes,
    shipmentsRes,
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
    supabase.from('products').select('*').eq('user_id', user.id),
    supabase.from('inventory_movements').select('*').eq('user_id', user.id),
    supabase.from('inventory_lots').select('*').eq('user_id', user.id),
    supabase.from('import_lots').select('*').eq('user_id', user.id),
    supabase.from('cost_sheets').select('*').eq('user_id', user.id),
    supabase.from('cost_sheet_cells').select('*').eq('user_id', user.id),
    supabase.from('report_settings').select('*').eq('user_id', user.id),
    supabase.from('shipments').select('*').eq('user_id', user.id),
  ]);

  // Clean lines data (remove join artifact)
  const cleanLines = (linesRes.data || []).map(({ journal_entries, ...line }) => line);

  return {
    version: '2.0',
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
    products: productsRes.data || [],
    inventory_movements: invMovementsRes.data || [],
    inventory_lots: invLotsRes.data || [],
    import_lots: importLotsRes.data || [],
    cost_sheets: costSheetsRes.data || [],
    cost_sheet_cells: costCellsRes.data || [],
    report_settings: reportSettingsRes.data || [],
    shipments: shipmentsRes.data || [],
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

  // Helper: delete with error check
  const safeDelete = async (table: string) => {
    const { error } = await (supabase.from(table as any) as any).delete().eq('user_id', user.id);
    if (error) throw new Error(`Error limpiando ${table}: ${error.message}`);
  };

  // Helper: chunked insert to avoid payload limits & partial failures
  const chunkedInsert = async (table: string, rows: any[], chunkSize = 500) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await (supabase.from(table as any) as any).insert(chunk);
      if (error) throw new Error(`Error insertando en ${table} (lote ${i / chunkSize + 1}): ${error.message}`);
    }
  };

  try {
    // Delete existing data in reverse order of dependencies
    // journal_lines are deleted via CASCADE when journal_entries are deleted
    // auxiliary_movement_details and inventory_movements are deleted via triggers on journal_entries delete
    await safeDelete('shipments');
    await safeDelete('auxiliary_movement_details');
    await safeDelete('auxiliary_ledger');
    await safeDelete('auxiliary_ledger_definitions');
    await safeDelete('kardex_movements');
    await safeDelete('kardex_entries');
    await safeDelete('kardex_definitions');
    await safeDelete('quarterly_closures');
    await safeDelete('inventory_movements');
    await safeDelete('inventory_lots');
    await safeDelete('import_lots');
    await safeDelete('cost_sheet_cells');
    await safeDelete('cost_sheets');
    await safeDelete('products');
    await safeDelete('report_settings');
    // Delete journal_lines explicitly first (no user_id column, so use entry_id via RLS)
    // Then journal_entries
    const { error: linesDelError } = await supabase
      .from('journal_lines')
      .delete()
      .gte('id', 0); // RLS will scope to user's entries
    if (linesDelError) throw new Error(`Error limpiando journal_lines: ${linesDelError.message}`);
    await safeDelete('journal_entries');
    await safeDelete('accounts');

    // Insert new data with correct user_id
    if (backup.accounts.length > 0) {
      const accounts = backup.accounts.map(a => ({ ...a, user_id: user.id }));
      await chunkedInsert('accounts', accounts);
    }

    if (backup.journal_entries.length > 0) {
      const entries = backup.journal_entries.map(e => ({ ...e, user_id: user.id }));
      await chunkedInsert('journal_entries', entries);
    }

    if (backup.journal_lines.length > 0) {
      // Strip auto-generated id to let DB regenerate (avoids sequence conflicts)
      const lines = backup.journal_lines.map(({ id, ...rest }: any) => rest);
      await chunkedInsert('journal_lines', lines);
    }

    if (backup.auxiliary_ledger_definitions?.length) {
      const defs = backup.auxiliary_ledger_definitions.map(d => ({ ...d, user_id: user.id }));
      await chunkedInsert('auxiliary_ledger_definitions', defs);
    }

    if (backup.auxiliary_ledger?.length) {
      const ledger = backup.auxiliary_ledger.map(l => ({ ...l, user_id: user.id }));
      await chunkedInsert('auxiliary_ledger', ledger);
    }

    if (backup.auxiliary_movement_details?.length) {
      const movements = backup.auxiliary_movement_details.map(m => ({ ...m, user_id: user.id }));
      await chunkedInsert('auxiliary_movement_details', movements);
    }

    if (backup.kardex_definitions?.length) {
      const defs = backup.kardex_definitions.map(d => ({ ...d, user_id: user.id }));
      await chunkedInsert('kardex_definitions', defs);
    }

    if (backup.kardex_entries?.length) {
      const entries = backup.kardex_entries.map(e => ({ ...e, user_id: user.id }));
      await chunkedInsert('kardex_entries', entries);
    }

    if (backup.kardex_movements?.length) {
      const movements = backup.kardex_movements.map(m => ({ ...m, user_id: user.id }));
      await chunkedInsert('kardex_movements', movements);
    }

    if (backup.quarterly_closures?.length) {
      const closures = backup.quarterly_closures.map(c => ({ ...c, user_id: user.id }));
      await chunkedInsert('quarterly_closures', closures);
    }

    // v2.0 tables
    if (backup.products?.length) {
      const products = backup.products.map(p => ({ ...p, user_id: user.id }));
      await chunkedInsert('products', products);
    }

    if (backup.import_lots?.length) {
      const lots = backup.import_lots.map(l => ({ ...l, user_id: user.id }));
      await chunkedInsert('import_lots', lots);
    }

    if (backup.inventory_lots?.length) {
      const lots = backup.inventory_lots.map(l => ({ ...l, user_id: user.id }));
      await chunkedInsert('inventory_lots', lots);
    }

    if (backup.inventory_movements?.length) {
      const movements = backup.inventory_movements.map(m => ({ ...m, user_id: user.id }));
      await chunkedInsert('inventory_movements', movements);
    }

    if (backup.cost_sheets?.length) {
      const sheets = backup.cost_sheets.map(s => ({ ...s, user_id: user.id }));
      await chunkedInsert('cost_sheets', sheets);
    }

    if (backup.cost_sheet_cells?.length) {
      const cells = backup.cost_sheet_cells.map(c => ({ ...c, user_id: user.id }));
      await chunkedInsert('cost_sheet_cells', cells);
    }

    if (backup.report_settings?.length) {
      const settings = backup.report_settings.map(s => ({ ...s, user_id: user.id }));
      await chunkedInsert('report_settings', settings);
    }

    // Shipments (now in Supabase)
    if (backup.shipments?.length) {
      // Handle both old format (full Shipment objects) and new format (DB rows)
      const shipmentRows = backup.shipments.map((s: any) => {
        if (s.user_id && s.data) {
          // Already in DB row format
          return { ...s, user_id: user.id };
        }
        // Old localStorage format — convert
        const { id, numero, status, ...rest } = s;
        return { id, user_id: user.id, numero, status, data: rest };
      });
      await chunkedInsert('shipments', shipmentRows);
    }

    const extras = [];
    if (backup.products?.length) extras.push(`${backup.products.length} productos`);
    if (backup.shipments?.length) extras.push(`${backup.shipments.length} embarques`);

    return { 
      success: true, 
      message: `Restauración completada: ${backup.accounts.length} cuentas, ${backup.journal_entries.length} asientos${extras.length ? ', ' + extras.join(', ') : ''}` 
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
