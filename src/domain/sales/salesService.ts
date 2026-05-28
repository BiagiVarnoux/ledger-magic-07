import { supabase } from '@/integrations/supabase/client';
import { calculateTaxes } from './calculateTaxes';
import { resolveAccounts } from './resolveAccounts';
import type { CreateSalePayload, SaleHeaderInput, SaleItemInput, SaleRow } from './types';
import { DEFAULT_COMPANY_ID } from '@/lib/constants';

export interface CreateSaleResult {
  success: boolean;
  sale_id: string;
  numero: string;
}

export async function createSale(
  header: SaleHeaderInput,
  items: SaleItemInput[],
  companyId: string = DEFAULT_COMPANY_ID
): Promise<CreateSaleResult> {
  if (items.length === 0) throw new Error('Agrega al menos un producto');
  for (const it of items) {
    if (!it.product_id) throw new Error('Producto sin seleccionar');
    if (it.cantidad <= 0) throw new Error(`Cantidad inválida en ${it.product_nombre}`);
    if (it.precio_unitario_neto <= 0) throw new Error(`Precio inválido en ${it.product_nombre}`);
  }

  const totals = calculateTaxes(items, header.con_factura);
  const accounts = resolveAccounts(header.canal, header.tipo_pago);

  const payload = {
    ...header,
    ...totals,
    ...accounts,
    items,
    company_id: companyId,
  };

  const { data, error } = await supabase.rpc('create_sale', { payload: payload as any });
  if (error) throw new Error(error.message);
  return data as unknown as CreateSaleResult;
}

export async function voidSale(saleId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('Motivo requerido');
  const { error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function listSales(): Promise<SaleRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SaleRow[];
}
