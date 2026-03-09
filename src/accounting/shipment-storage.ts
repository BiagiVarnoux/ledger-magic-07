// src/accounting/shipment-storage.ts
// Persistencia de embarques en Supabase

import { Shipment } from './shipment-types';
import { supabase } from '@/integrations/supabase/client';

// Helper: convert DB row to Shipment
function rowToShipment(row: any): Shipment {
  const data = row.data || {};
  return {
    ...data,
    id: row.id,
    numero: row.numero,
    status: row.status,
    created_at: data.created_at || row.created_at,
  };
}

// Helper: convert Shipment to DB row fields
function shipmentToRow(s: Shipment, userId: string) {
  const { id, numero, status, ...rest } = s;
  return {
    id,
    user_id: userId,
    numero,
    status,
    data: rest,
  };
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');
  return user.id;
}

export const ShipmentStorage = {
  async load(): Promise<Shipment[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToShipment);
  },

  async save(shipments: Shipment[]): Promise<void> {
    const userId = await getUserId();
    // Delete all and re-insert (used by backup restore)
    await supabase.from('shipments').delete().eq('user_id', userId);
    if (shipments.length > 0) {
      const rows = shipments.map(s => shipmentToRow(s, userId));
      const { error } = await supabase.from('shipments').insert(rows);
      if (error) throw error;
    }
  },

  async upsert(shipment: Shipment): Promise<void> {
    const userId = await getUserId();
    const row = shipmentToRow(shipment, userId);
    const { error } = await supabase
      .from('shipments')
      .upsert(row, { onConflict: 'id' });
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getById(id: string): Promise<Shipment | undefined> {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToShipment(data) : undefined;
  },

  // Migration helper: import from localStorage to Supabase
  async migrateFromLocalStorage(): Promise<number> {
    const LS_KEY = 'shipments_v1';
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return 0;
      const old: Shipment[] = JSON.parse(raw);
      if (!old.length) return 0;

      const userId = await getUserId();
      const rows = old.map(s => shipmentToRow(s, userId));
      const { error } = await supabase.from('shipments').upsert(rows, { onConflict: 'id' });
      if (error) throw error;

      // Clear localStorage after successful migration
      localStorage.removeItem(LS_KEY);
      return old.length;
    } catch {
      return 0;
    }
  },
};
