// Inventory (D-019): physical equipment and handsets only. Services (plans, add-ons) and descriptive `-BASE` SKUs have none.
import type { InventoryDraft } from '../types';
import { inventoryKey } from '../reconcilers/inventory';
import { EQUIPMENT_PRICES } from './prices';
import { DEVICES, deviceSku, deviceVariants } from './products/devices';

export const EQUIPMENT_STOCK = 500;
export const DEVICE_STOCK = 200;
/** The out-of-stock case. */
export const OUT_OF_STOCK_SKU = 'MLV-DEV-NOVAPRO-VLT-512';

function entry(sku: string, quantityOnStock: number): InventoryDraft {
  return { key: inventoryKey(sku), sku, quantityOnStock };
}

export const equipmentInventory: InventoryDraft[] = Object.values(EQUIPMENT_PRICES).flatMap((price) =>
  [price.rent, price.buy].flatMap((v) => (v ? [entry(v.sku, EQUIPMENT_STOCK)] : [])),
);

export const deviceInventory: InventoryDraft[] = DEVICES.flatMap((spec) =>
  deviceVariants(spec).map(({ color, memory }) => {
    const sku = deviceSku(spec, color, memory);
    return entry(sku, sku === OUT_OF_STOCK_SKU ? 0 : DEVICE_STOCK);
  }),
);

export const inventory: InventoryDraft[] = [...equipmentInventory, ...deviceInventory];
