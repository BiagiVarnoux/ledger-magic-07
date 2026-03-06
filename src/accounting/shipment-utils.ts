// src/accounting/shipment-utils.ts
// Fórmulas exactas del Excel de importaciones

import { round2 } from './utils';
import { ShipmentProduct, Shipment, ShipmentExpense } from './shipment-types';

// ─── Fórmulas por producto ────────────────────────────────────────────────────

/** Precio en Bs (paralelo): precio_usd × (1 + tax_pct/100) × tc_paralelo */
export function calcPrecioBs(p: ShipmentProduct, tc_paralelo: number): number {
  const precioUsdConTax = p.precio_usd * (1 + p.tax_pct / 100);
  return round2(precioUsdConTax * tc_paralelo);
}

/** Precio BOB (para tributos): precio_usd × 6.97 (T/C oficial) */
export function calcPrecioBOB(p: ShipmentProduct, tc_oficial: number): number {
  return round2(p.precio_usd * tc_oficial);
}

/** Peso volumen: (M1 × M2 × M3) / 5000 */
export function calcPesoVolumen(p: ShipmentProduct): number | undefined {
  if (!p.m1 || !p.m2 || !p.m3) return undefined;
  return round2((p.m1 * p.m2 * p.m3) / 5000);
}

/** Peso efectivo: el mayor entre peso volumen y peso bruto (criterio courier) */
export function calcPesoEfectivo(p: ShipmentProduct): number | undefined {
  const pv = calcPesoVolumen(p);
  if (!pv && !p.peso_bruto) return undefined;
  if (!pv) return p.peso_bruto;
  if (!p.peso_bruto) return pv;
  return Math.max(pv, p.peso_bruto);
}

/**
 * Envío por unidad: peso_efectivo × tarifa_flete_por_kg × tc_paralelo
 * La tarifa_flete_por_kg es el valor en USD/kg (aprox 11 USD/kg según Excel: M2*11*T/C)
 * Nota: en el Excel es (PESO * 11) * T/C — donde 11 es USD/kg y T/C es el paralelo
 */
export function calcEnvioUnitario(
  p: ShipmentProduct,
  tc_paralelo: number,
  tarifa_usd_por_kg: number = 11
): number | undefined {
  const peso = calcPesoEfectivo(p);
  if (!peso) return undefined;
  return round2(peso * tarifa_usd_por_kg * tc_paralelo);
}

/**
 * GA estimado: (precio_BOB + envio + precio_BOB*0.02) × (ga_pct/100)
 * Base = precio BOB + flete + 2% del precio BOB
 */
export function calcGAEstimado(
  p: ShipmentProduct,
  tc_oficial: number,
  envioUnitario: number
): number {
  const precioBOB = calcPrecioBOB(p, tc_oficial);
  const base = precioBOB + envioUnitario + precioBOB * 0.02;
  return round2(base * (p.ga_pct / 100));
}

/**
 * IVA estimado: (precio_BOB + GA) × 14.94%
 */
export function calcIVAEstimado(
  p: ShipmentProduct,
  tc_oficial: number,
  ga: number
): number {
  const precioBOB = calcPrecioBOB(p, tc_oficial);
  return round2((precioBOB + ga) * 0.1494);
}

/** Total de impuestos estimados: GA + IVA */
export function calcImpuestosEstimados(ga: number, iva: number): number {
  return round2(ga + iva);
}

/**
 * Costo total estimado por unidad:
 * precio_bs + envio + impuestos + manipuleo + bateria
 */
export function calcTotalIndividualEstimado(
  precioBs: number,
  envio: number,
  impuestos: number,
  manipuleo: number,
  bateria: number
): number {
  return round2(precioBs + envio + impuestos + manipuleo + bateria);
}

// ─── Prorrateo al cerrar el embarque ──────────────────────────────────────────

/**
 * Calcula el peso efectivo total del embarque (suma de todos los productos × cantidad)
 */
export function calcPesoTotalEmbarque(products: ShipmentProduct[]): number {
  return round2(
    products.reduce((sum, p) => {
      const peso = calcPesoEfectivo(p) ?? 0;
      return sum + peso * p.cantidad;
    }, 0)
  );
}

/**
 * Prorratea el flete total entre los productos según peso efectivo.
 * Retorna el costo de envío por UNIDAD de cada producto.
 */
export function calcFleteProrrateado(
  products: ShipmentProduct[],
  flete_total_bs: number
): Record<string, number> {
  const pesoTotal = calcPesoTotalEmbarque(products);
  const result: Record<string, number> = {};

  if (pesoTotal === 0) return result;

  products.forEach(p => {
    const peso = calcPesoEfectivo(p) ?? 0;
    const participacion = peso / pesoTotal;
    const fleteTotal = round2(flete_total_bs * participacion);
    result[p.id] = round2(fleteTotal / p.cantidad); // por unidad
  });

  return result;
}

/**
 * Prorratea los gastos de aduana (manipuleo) entre los productos según peso efectivo.
 * Retorna el costo de manipuleo por UNIDAD de cada producto.
 */
export function calcManipuleoProrrateado(
  products: ShipmentProduct[],
  gastos_aduana: ShipmentExpense[]
): Record<string, number> {
  const totalManipuleo = gastos_aduana.reduce((s, g) => s + g.monto, 0);
  const pesoTotal = calcPesoTotalEmbarque(products);
  const result: Record<string, number> = {};

  if (pesoTotal === 0 || totalManipuleo === 0) return result;

  products.forEach(p => {
    const peso = calcPesoEfectivo(p) ?? 0;
    const participacion = peso / pesoTotal;
    const manipuleoTotal = round2(totalManipuleo * participacion);
    result[p.id] = round2(manipuleoTotal / p.cantidad); // por unidad
  });

  return result;
}

/**
 * Calcula el costo total real por unidad de cada producto al cerrar el embarque.
 * Usa los montos del DIM si están disponibles (ga_monto, iva_monto),
 * de lo contrario usa los estimados.
 */
export function calcCostoFinalPorProducto(
  shipment: Shipment
): Array<{ product: ShipmentProduct; costo_unitario: number; detalle: CostoDetalle }> {
  const { products, tc_paralelo, tc_oficial, flete_total_bs = 0, gastos_aduana } = shipment;

  const fleteMap = calcFleteProrrateado(products, flete_total_bs);
  const manipuleoMap = calcManipuleoProrrateado(products, gastos_aduana);

  return products.map(p => {
    const precioBs = calcPrecioBs(p, tc_paralelo);
    const envioUnitario = fleteMap[p.id] ?? 0;

    // GA: usar monto del DIM si existe, sino estimado
    const ga = p.ga_monto != null
      ? round2(p.ga_monto / p.cantidad)
      : calcGAEstimado(p, tc_oficial, envioUnitario);

    // IVA: usar monto del DIM si existe, sino estimado
    const iva = p.iva_monto != null
      ? round2(p.iva_monto / p.cantidad)
      : calcIVAEstimado(p, tc_oficial, ga);

    const manipuleo = manipuleoMap[p.id] ?? 0;
    const bateria = p.tiene_bateria ? p.costo_bateria : 0;
    const impuestos = round2(ga + iva);

    const costo_unitario = round2(precioBs + envioUnitario + impuestos + manipuleo + bateria);

    return {
      product: p,
      costo_unitario,
      detalle: { precioBs, envioUnitario, ga, iva, impuestos, manipuleo, bateria },
    };
  });
}

export interface CostoDetalle {
  precioBs: number;
  envioUnitario: number;
  ga: number;
  iva: number;
  impuestos: number;
  manipuleo: number;
  bateria: number;
}

// ─── Generación de número de embarque ────────────────────────────────────────

export function generateShipmentNumber(existing: Shipment[]): string {
  const year = new Date().getFullYear();
  const thisYear = existing.filter(s => s.numero.includes(`-${year}-`));
  const next = String(thisYear.length + 1).padStart(3, '0');
  return `EMB-${year}-${next}`;
}
