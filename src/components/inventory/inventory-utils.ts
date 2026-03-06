export interface InventoryMovement {
  id: string;
  product_id: string;
  fecha: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  metodo_valuacion: string;
  referencia: string | null;
  journal_entry_id: string | null;
  user_id: string;
  created_at: string;
  inventory_lot_id?: string | null;
}

export interface ProductState {
  saldo: number;
  costoUnitario: number;
  saldoValorado: number;
  ultimaFecha: string;
}

export interface KardexRow {
  fecha: string;
  concepto: string;
  entrada: number;
  salida: number;
  saldo: number;
  costoUnitario: number;
  saldoValorado: number;
}

export function calcularEstadoProducto(movements: InventoryMovement[]): ProductState {
  const sorted = [...movements].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at)
  );

  let saldo = 0;
  let saldoValorado = 0;
  let ultimaFecha = '';

  for (const mov of sorted) {
    if (mov.tipo === 'ENTRADA') {
      saldo += mov.cantidad;
      saldoValorado += mov.costo_total;
    } else if (mov.tipo === 'SALIDA') {
      const cpp = saldo > 0 ? saldoValorado / saldo : 0;
      saldo -= mov.cantidad;
      saldoValorado = saldo * cpp;
    }
    ultimaFecha = mov.fecha;
  }

  return {
    saldo,
    costoUnitario: saldo > 0 ? saldoValorado / saldo : 0,
    saldoValorado,
    ultimaFecha,
  };
}

export function buildKardexRows(movements: InventoryMovement[]): KardexRow[] {
  const sorted = [...movements].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at)
  );

  let saldo = 0;
  let saldoValorado = 0;
  const rows: KardexRow[] = [];

  for (const mov of sorted) {
    if (mov.tipo === 'ENTRADA') {
      saldo += mov.cantidad;
      saldoValorado += mov.costo_total;
    } else if (mov.tipo === 'SALIDA') {
      const cpp = saldo > 0 ? saldoValorado / saldo : 0;
      saldo -= mov.cantidad;
      saldoValorado = saldo * cpp;
    }

    rows.push({
      fecha: mov.fecha,
      concepto: mov.referencia || (mov.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'),
      entrada: mov.tipo === 'ENTRADA' ? mov.cantidad : 0,
      salida: mov.tipo === 'SALIDA' ? mov.cantidad : 0,
      saldo,
      costoUnitario: saldo > 0 ? saldoValorado / saldo : 0,
      saldoValorado,
    });
  }

  return rows;
}
