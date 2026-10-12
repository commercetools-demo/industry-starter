// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Stock per branch of the store (S-02, decisions 4 and 5). A branch is a supply channel of the store that is also a distribution
// channel (seed: roles InventorySupply and ProductDistribution, Q-005); the central warehouse is not a branch.
import 'server-only';
import type { Channel, InventoryEntry } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';
import type { LocalizedString } from '@/lib/types';
import { withTimeout } from './timeout';
import type { BranchStock } from '@/lib/dashboard/types';

export const LOW_STOCK_THRESHOLD = 5;
const TOP_PER_BRANCH = 5;
const PRODUCT_BATCH = 100;
const INVENTORY_PAGE = 500;

interface Branch {
  id: string;
  key: string;
  name: LocalizedString;
}

async function loadBranches(storeKey: string): Promise<Branch[]> {
  const { body } = await adminRoot.stores().withKey({ key: storeKey }).get({ queryArgs: { expand: ['supplyChannels[*]'] } }).execute();
  return (body.supplyChannels ?? [])
    .map((ref) => ref.obj as Channel | undefined)
    .filter((c): c is Channel => c !== undefined && (c.roles as string[]).includes('ProductDistribution'))
    .map((c) => ({ id: c.id, key: c.key, name: c.name ?? { 'en-US': c.key } }));
}

const inChannel = (id: string) => `supplyChannel(id="${id.replace(/["\\]/g, '')}")`;

async function inventoryOf(branch: Branch, extra = '', limit = INVENTORY_PAGE): Promise<InventoryEntry[]> {
  const { body } = await adminRoot
    .inventory()
    .get({ queryArgs: { where: `${inChannel(branch.id)}${extra}`, sort: 'availableQuantity asc', limit } })
    .execute();
  return body.results;
}

async function partNames(skus: string[]): Promise<Map<string, LocalizedString>> {
  const names = new Map<string, LocalizedString>();
  const unique = [...new Set(skus)];
  if (unique.length === 0) return names;
  // One batched lookup per 100 SKUs (not per part).
  for (let i = 0; i < unique.length; i += PRODUCT_BATCH) {
    const list = unique
      .slice(i, i + PRODUCT_BATCH)
      .map((s) => `"${s.replace(/["\\]/g, '')}"`)
      .join(',');
    const { body } = await adminRoot
      .productProjections()
      .get({ queryArgs: { where: `masterVariant(sku in (${list})) or variants(sku in (${list}))`, limit: PRODUCT_BATCH } })
      .execute();
    for (const p of body.results) {
      for (const v of [p.masterVariant, ...p.variants]) if (v.sku) names.set(v.sku, p.name);
    }
  }
  return names;
}

/** Per branch, the parts at or below the threshold, lowest first, top five. */
export function lowStockByBranch(storeKey: string): Promise<BranchStock[]> {
  return withTimeout(
    (async () => {
      const branches = await loadBranches(storeKey);
      const perBranch = await Promise.all(
        branches.map(async (branch) => ({ branch, entries: (await inventoryOf(branch, ` and availableQuantity <= ${LOW_STOCK_THRESHOLD}`, 100)).slice(0, TOP_PER_BRANCH) })),
      );
      const names = await partNames(perBranch.flatMap((b) => b.entries.map((e) => e.sku)));
      return perBranch.map(({ branch, entries }) => ({
        branch: { key: branch.key, name: branch.name },
        parts: entries.map((e) => ({ sku: e.sku, name: names.get(e.sku) ?? { 'en-US': e.sku }, available: e.availableQuantity })),
      }));
    })(),
  );
}

/** Parts stocked in at least one branch of the store whose available quantity is 0 in every branch (one inventory request per branch). */
export function countOutOfStockEverywhere(storeKey: string): Promise<number> {
  return withTimeout(
    (async () => {
      const branches = await loadBranches(storeKey);
      const totals = new Map<string, number>();
      for (const entries of await Promise.all(branches.map((b) => inventoryOf(b)))) {
        for (const e of entries) totals.set(e.sku, (totals.get(e.sku) ?? 0) + e.availableQuantity);
      }
      return [...totals.values()].filter((sum) => sum === 0).length;
    })(),
  );
}
