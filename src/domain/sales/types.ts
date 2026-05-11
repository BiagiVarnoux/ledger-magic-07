// Pure types for the sales domain — no React, no Supabase imports.

export type Canal = 'licitacion' | 'electronica' | 'pedido' | 'general';

export type TipoPago =
  | 'caja_mn'
  | 'banco_mn'
  | 'banco_me'
  | 'facebank'
  | 'facebank2'
  | 'facebank3'
  | 'usdt'
  | 'usdt2'
  | 'cxc'
  | 'cxc_licitaciones';

export type MetodoValuacion = 'CPP' | 'FIFO';

export interface SaleItemInput {
  product_id: string;
  product_nombre: string;
  product_codigo?: string | null;
  cuenta_inventario_id?: string | null;
  metodo_valuacion: MetodoValuacion;
  cantidad: number;
  precio_unitario_neto: number;
}

export interface SaleHeaderInput {
  fecha: string;            // YYYY-MM-DD
  canal: Canal;
  con_factura: boolean;
  tipo_pago: TipoPago;
  cliente_nombre?: string | null;
  glosa?: string | null;
  aux_entry_id?: string | null;
}

export interface SaleTotals {
  total_cobrado: number;
  total_iva: number;
  total_it: number;
  precio_neto_total: number;
}

export interface ResolvedAccounts {
  payment_account: string;
  revenue_account: string;
  cogs_account: string;
}

export interface CreateSalePayload extends SaleHeaderInput, SaleTotals, ResolvedAccounts {
  items: SaleItemInput[];
}

export interface SaleRow {
  id: string;
  numero: string;
  fecha: string;
  canal: Canal;
  con_factura: boolean;
  tipo_pago: TipoPago;
  cliente_nombre: string | null;
  glosa: string | null;
  total_cobrado: number;
  total_iva: number;
  total_it: number;
  precio_neto_total: number;
  total_costo: number | null;
  journal_entry_id: string | null;
  estado: 'confirmed' | 'voided';
  void_reason: string | null;
  void_journal_entry_id: string | null;
  created_at: string;
}
