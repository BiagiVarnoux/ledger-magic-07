import { round2 } from '@/accounting/utils';
import type { SaleItemInput, SaleTotals } from './types';

/**
 * Bolivian tax rules (Ley 843)
 *
 * sin_factura → no IVA, no IT (full amount goes to Ventas)
 * con_factura → IVA 13% (P.3) + IT 3% gasto/por pagar (G.3 / P.2)
 *
 * The price the customer is charged (`total_cobrado`) is treated as the
 * gross amount when factura applies (i.e. it already includes IVA).
 */
export function calculateTaxes(
  items: Pick<SaleItemInput, 'cantidad' | 'precio_unitario_neto'>[],
  conFactura: boolean
): SaleTotals {
  const totalCobrado = round2(
    items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario_neto, 0)
  );

  if (!conFactura) {
    return {
      total_cobrado: totalCobrado,
      total_iva: 0,
      total_it: 0,
      precio_neto_total: totalCobrado,
    };
  }

  const totalIva = round2(totalCobrado * 0.13);
  const precioNeto = round2(totalCobrado - totalIva);
  const totalIt = round2(totalCobrado * 0.03);

  return {
    total_cobrado: totalCobrado,
    total_iva: totalIva,
    total_it: totalIt,
    precio_neto_total: precioNeto,
  };
}
