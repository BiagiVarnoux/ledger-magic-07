// src/accounting/kardex-utils.ts
// Centralized CPP (Costo Promedio Ponderado) calculation utilities

export interface KardexMovementInput {
  entrada: number;
  salidas: number;
  costo_total: number;
}

export interface KardexMovementWithCPP extends KardexMovementInput {
  saldo: number;
  costo_unitario: number;
  saldo_valorado: number;
}

/**
 * Calculate CPP (Weighted Average Cost) for a sequence of movements
 * @param movements - Array of movements with entrada, salidas, costo_total
 * @returns Array of movements with calculated saldo, costo_unitario, saldo_valorado
 */
export function calculateCPP<T extends KardexMovementInput>(
  movements: T[]
): (T & KardexMovementWithCPP)[] {
  let saldoAcumulado = 0;
  let saldoValoradoAcumulado = 0;

  return movements.map((mov) => {
    const entrada = Number(mov.entrada) || 0;
    const salidas = Number(mov.salidas) || 0;
    const costoTotal = Number(mov.costo_total) || 0;

    if (entrada > 0) {
      // ENTRADA: Calcular nuevo promedio ponderado (CPP)
      saldoValoradoAcumulado += costoTotal;
      saldoAcumulado += entrada;
      
      const nuevoCPP = saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0;
      
      return {
        ...mov,
        saldo: saldoAcumulado,
        costo_unitario: nuevoCPP,
        saldo_valorado: saldoValoradoAcumulado
      };
    }

    if (salidas > 0) {
      // SALIDA: Usar CPP actual
      const cppActual = saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0;
      saldoAcumulado -= salidas;
      const costoSalida = salidas * cppActual;
      saldoValoradoAcumulado -= costoSalida;

      return {
        ...mov,
        saldo: saldoAcumulado,
        costo_unitario: cppActual,
        costo_total: costoSalida,
        saldo_valorado: saldoValoradoAcumulado
      };
    }

    // No movement
    return {
      ...mov,
      saldo: saldoAcumulado,
      costo_unitario: saldoAcumulado > 0 ? saldoValoradoAcumulado / saldoAcumulado : 0,
      saldo_valorado: saldoValoradoAcumulado
    };
  });
}

/**
 * Calculate current balance and unit cost from movement history
 * @param movements - Array of movements
 * @returns Object with currentBalance, currentUnitCost, currentValuedBalance
 */
export function getCurrentKardexState(movements: KardexMovementInput[]): {
  currentBalance: number;
  currentUnitCost: number;
  currentValuedBalance: number;
} {
  let saldo = 0;
  let saldoValorado = 0;

  for (const mov of movements) {
    const entrada = Number(mov.entrada) || 0;
    const salidas = Number(mov.salidas) || 0;
    const costoTotal = Number(mov.costo_total) || 0;

    if (entrada > 0) {
      // ENTRADA: Calcular nuevo promedio ponderado
      const nuevoSaldo = saldo + entrada;
      const nuevoSaldoValorado = saldoValorado + costoTotal;
      saldo = nuevoSaldo;
      saldoValorado = nuevoSaldoValorado;
    } else if (salidas > 0) {
      // SALIDA: Mantener costo unitario, reducir saldo
      const costoUnitario = saldo > 0 ? saldoValorado / saldo : 0;
      saldo -= salidas;
      saldoValorado = saldo * costoUnitario;
    }
  }

  return {
    currentBalance: saldo,
    currentUnitCost: saldo > 0 ? saldoValorado / saldo : 0,
    currentValuedBalance: saldoValorado
  };
}
