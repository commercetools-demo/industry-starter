// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { InventoryEntryDraft, RecurrencePolicyDraft } from '@commercetools/platform-sdk';
import { K, hash, ls } from './base';
import { OUT_OF_STOCK_AT_STORE, allVariants } from './products';
import { STORE_KEYS } from './stores';

export const recurrencePolicyDrafts: RecurrencePolicyDraft[] = [
  { key: K.rpEvery2Weeks, name: ls('Every 2 weeks', 'Alle 2 Wochen'), schedule: { type: 'standard', value: 2, intervalUnit: 'Weeks' } },
  { key: K.rpEveryMonth, name: ls('Every month', 'Jeden Monat'), schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } },
  { key: K.rpEvery2Months, name: ls('Every 2 months', 'Alle 2 Monate'), schedule: { type: 'standard', value: 2, intervalUnit: 'Months' } },
  { key: K.rpEvery3Months, name: ls('Every 3 months', 'Alle 3 Monate'), schedule: { type: 'standard', value: 3, intervalUnit: 'Months' } },
];

/** Stock at or below this quantity counts as low stock (SEED-PLAN section 11; the storefront reads the same value from config). */
export const LOW_STOCK_THRESHOLD = 5;

export const inventoryKey = (sku: string, storeKey?: string): string => `mcf-inv-${sku.toLowerCase()}-${storeKey ? storeKey.replace('mcf-store-', '') : 'online'}`;

/**
 * Deterministic quantity from the SKU and store key, so every run is the same.
 * Online: always in stock (40 to 499). Store: 1 in 20 entries is 0, 1 in 7 is low (1 to 5), the rest 6 to 65.
 * The two products of OUT_OF_STOCK_AT_STORE are 0 at that store and stay in stock online.
 */
export function quantityFor(sku: string, productCode: string, storeKey?: string): number {
  if (!storeKey) return 40 + (hash(`${sku}@online`) % 460);
  if (storeKey === OUT_OF_STOCK_AT_STORE.store && (OUT_OF_STOCK_AT_STORE.codes as readonly string[]).includes(productCode)) return 0;
  const h = hash(`${sku}@${storeKey}`);
  if (h % 20 === 0) return 0;
  if (h % 7 === 0) return 1 + ((h >>> 8) % LOW_STOCK_THRESHOLD);
  return 6 + ((h >>> 8) % 60);
}

/** One entry per variant without a channel (online) and one per store channel. */
export function inventoryDrafts(): InventoryEntryDraft[] {
  const out: InventoryEntryDraft[] = [];
  for (const { product, variant } of allVariants()) {
    out.push({ key: inventoryKey(variant.sku), sku: variant.sku, quantityOnStock: quantityFor(variant.sku, product.code) });
    for (const store of STORE_KEYS) {
      out.push({
        key: inventoryKey(variant.sku, store), sku: variant.sku, supplyChannel: { typeId: 'channel', key: store },
        quantityOnStock: quantityFor(variant.sku, product.code, store),
      });
    }
  }
  return out;
}
