import { supabase } from '@/integrations/supabase/client';
import type { ProductStockInfo } from './types';

/**
 * Carga el stock disponible y CPP de múltiples productos en una sola
 * llamada al RPC get_products_stock_batch.
 * Retorna un mapa product_id → ProductStockInfo para acceso O(1).
 */
export async function fetchProductsStockBatch(
  productIds: string[]
): Promise<Record<string, ProductStockInfo>> {
  if (productIds.length === 0) return {};

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase.rpc('get_products_stock_batch', {
    p_product_ids: productIds,
    p_user_id: user.id,
  });

  if (error) throw new Error(error.message);

  const map: Record<string, ProductStockInfo> = {};
  // data es any[] por ser respuesta de RPC no tipado en el cliente generado
  for (const row of (data ?? []) as ProductStockInfo[]) {
    map[row.product_id] = row;
  }
  return map;
}
