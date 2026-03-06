// src/accounting/shipment-storage.ts
// Persistencia de embarques en localStorage (compatible con el patrón del proyecto)

import { Shipment } from './shipment-types';

const LS_SHIPMENTS = 'shipments_v1';

export const ShipmentStorage = {
  load(): Shipment[] {
    try {
      const raw = localStorage.getItem(LS_SHIPMENTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  save(shipments: Shipment[]): void {
    localStorage.setItem(LS_SHIPMENTS, JSON.stringify(shipments));
  },

  upsert(shipment: Shipment): void {
    const list = ShipmentStorage.load();
    const idx = list.findIndex(s => s.id === shipment.id);
    if (idx >= 0) {
      list[idx] = shipment;
    } else {
      list.unshift(shipment); // más reciente primero
    }
    ShipmentStorage.save(list);
  },

  delete(id: string): void {
    const list = ShipmentStorage.load().filter(s => s.id !== id);
    ShipmentStorage.save(list);
  },

  getById(id: string): Shipment | undefined {
    return ShipmentStorage.load().find(s => s.id === id);
  },
};
