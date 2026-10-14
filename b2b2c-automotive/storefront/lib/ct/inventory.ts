// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Stock per cart line (workstream N, D13 and D14). The cart runs `inventoryMode: TrackOnly`, which checks nothing and may oversell,
// so the app caps the quantity itself. Branch stock is the inventory entry of the branch supply channel, "ships later" stock is
// the entry of the Malva warehouse supply channel; the seed writes no channel-less entries.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { splitStock, type LineStock } from '@/lib/store/stock';

export const WAREHOUSE_SUPPLY_CHANNEL_KEY = 'mau-supply-malva-dc';
export type { LineStock };

const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Quantity of each sku at the branch and in the warehouse: one inventory call for all skus. */
export async function getLineStock(skus: string[], branchChannelId: string | undefined): Promise<Map<string, LineStock>> {
  const unique = [...new Set(skus)];
  const result = new Map<string, LineStock>(unique.map((sku) => [sku, { branchQty: 0, masterQty: 0 }]));
  if (unique.length === 0) return result;
  for (const sku of unique) if (!SKU.test(sku)) throw new Error('Invalid sku');
  if (branchChannelId !== undefined && !ID.test(branchChannelId)) throw new Error('Invalid channel id');
  const channels = [`supplyChannel(key="${WAREHOUSE_SUPPLY_CHANNEL_KEY}")`, ...(branchChannelId ? [`supplyChannel(id="${branchChannelId}")`] : [])];
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku in (${unique.map((s) => `"${s}"`).join(',')}) and (${channels.join(' or ')})`, limit: 500 } })
    .execute();
  for (const entry of body.results) {
    const stock = result.get(entry.sku);
    if (!stock) continue;
    const quantity = Math.max(0, entry.availableQuantity ?? 0);
    if (branchChannelId && entry.supplyChannel?.id === branchChannelId) stock.branchQty = quantity;
    else stock.masterQty = quantity;
  }
  return result;
}

export { splitStock };
