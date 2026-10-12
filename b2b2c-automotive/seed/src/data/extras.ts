// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { InventoryEntryDraft, RecurrencePolicyDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';
import { assortmentSkus, masterSkus } from './assortment';
import { BRANCHES } from './org';
import { LOCAL_PARTS } from './items';
import { PARTS } from './parts';
import { hash } from './pricing';

// ---------- subscriptions-ready recurrence policies ----------
export const recurrencePolicyDrafts: RecurrencePolicyDraft[] = [
  { key: 'mau-rp-monthly', name: ls('Monatlich', 'Monthly'), schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } },
  { key: 'mau-rp-quarterly', name: ls('Vierteljährlich', 'Every 3 months'), schedule: { type: 'standard', value: 3, intervalUnit: 'Months' } },
  { key: 'mau-rp-half-yearly', name: ls('Halbjährlich', 'Every 6 months'), schedule: { type: 'standard', value: 6, intervalUnit: 'Months' } },
];

// ---------- inventory ----------
export const inventoryKey = (sku: string, channelKey: string): string => `mau-inv-${sku.toLowerCase()}-${channelKey.replace(/^mau-/, '')}`;

/**
 * Central warehouse: every priced master part. Branches: the parts of their reseller's assortment, about 70 % in stock
 * (the rest ships from the warehouse, "Ships in 2-3 days"). Local parts are stocked in the owner's branches only.
 */
export function inventoryDrafts(): InventoryEntryDraft[] {
  const out: InventoryEntryDraft[] = [];
  const entry = (sku: string, channelKey: string, quantityOnStock: number): InventoryEntryDraft => ({
    key: inventoryKey(sku, channelKey), sku, supplyChannel: { typeId: 'channel', key: channelKey }, quantityOnStock,
  });
  for (const p of PARTS) if (p.eur !== null) out.push(entry(p.sku, K.supplyMalva, 150 + (hash(p.sku) % 400)));
  for (const b of BRANCHES) {
    const store = b.store;
    for (const sku of assortmentSkus(store)) {
      const isPart = PARTS.some((p) => p.sku === sku);
      const local = LOCAL_PARTS.find((l) => l.sku === sku);
      if (!isPart && !local) continue; // bundles have no stock of their own
      const h = hash(`${sku}@${b.key}`) % 10;
      if (h < 3) continue;
      out.push(entry(sku, b.key, 1 + (h * 3)));
    }
  }
  return out;
}

export { masterSkus };
