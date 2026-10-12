// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Branch stock and prices (workstream U-05, owner Q-005 and Q-003): a branch channel carries BOTH inventory and prices.
//   stock  = the inventory entry of the SKU on the branch supply channel (created when absent, else `changeQuantity`)
//   price  = a standalone price scoped to the branch channel, written ONLY through workstream T's `setStandalonePrice`
//            (single writer; seed key scheme `<sku>__<branchKey>`, `__usd` for USD), cleared by writing null
// With no branch price the store's channel price applies. There is no price floor (Q-T03): above zero is the only rule.
// The branch must belong to the store (404 otherwise) and the SKU must be in the store's assortment (422).
import 'server-only';
import type { StandalonePrice } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { adminRoot } from '@/lib/ct/admin-client';
import { standalonePriceKey, type PriceCurrency } from '@/lib/catalog/price-keys';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { fixtureStock } from '@/lib/portal/u-fixtures';
import { UnprocessableError } from '@/lib/store/errors';
import { STOCK_MAX } from '@/lib/store/schemas';
import type { StockPage, StockRow } from '@/lib/store/types';
import { assignedBySku, isAssigned } from './assortment';
import { catalogRoot } from './catalog-root';
import { assertBranchOfStore, requireBranchOfStore } from './branches';
import { setStandalonePrice } from './prices';
import { chunk, retryOnConflict } from './versioned';

export const STOCK_PAGE_SIZE = 50;

export type { StockPage, StockRow };

/** Branches in the US sell in USD, every other branch in EUR (the seed's price key scheme). */
export const currencyOfBranch = (country: string): PriceCurrency => (country === 'US' ? 'USD' : 'EUR');

export const inventoryKey = (sku: string, branchKey: string): string => `mau-inv-${sku}-${branchKey.replace(/^mau-br-/, '')}`.replace(/[^A-Za-z0-9_-]/g, '-');

async function readQuantities(channelId: string, skus: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const part of chunk([...skus], 50)) {
    const { body } = await adminRoot.inventory().get({ queryArgs: { where: 'sku in :skus and supplyChannel(id=:channel)', 'var.skus': part, 'var.channel': channelId, limit: 100 } }).execute();
    for (const entry of body.results) out.set(entry.sku, entry.availableQuantity);
  }
  return out;
}

async function readBranchPrices(branchKey: string, currency: PriceCurrency, skus: readonly string[]): Promise<Map<string, number>> {
  const root = await catalogRoot();
  const out = new Map<string, number>();
  for (const part of chunk([...skus], 50)) {
    const { body } = await root.standalonePrices().get({ queryArgs: { where: 'sku in :skus', 'var.skus': part, limit: 500 } }).execute();
    for (const price of body.results as StandalonePrice[]) {
      if (price.key === standalonePriceKey(price.sku, branchKey, currency) && price.value.currencyCode === currency) out.set(price.sku, price.value.centAmount);
    }
  }
  return out;
}

export async function listBranchStock(storeKey: string, branchKey: string, q: { offset?: number; limit?: number; text?: string } = {}): Promise<StockPage> {
  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(STOCK_PAGE_SIZE, Math.max(1, q.limit ?? STOCK_PAGE_SIZE));
  const live = !devFixturesEnabled();
  const channel = live ? await requireBranchOfStore(storeKey, branchKey) : null;
  if (!live) await assertBranchOfStore(storeKey, branchKey);
  const currency = currencyOfBranch(channel?.address?.country ?? (await fixtureStock.branchCountry(storeKey, branchKey)));
  const needle = q.text?.trim().toLowerCase();
  const assigned = [...(await assignedBySku(storeKey)).values()]
    .sort((a, b) => (a.sku < b.sku ? -1 : 1))
    .filter((i) => !needle || i.sku.toLowerCase().includes(needle) || Object.values(i.name).some((n) => n.toLowerCase().includes(needle)));
  const page = assigned.slice(offset, offset + limit);
  const skus = page.map((i) => i.sku);
  const [quantities, prices] = await Promise.all([
    channel ? readQuantities(channel.id, skus) : fixtureStock.quantities(storeKey, branchKey, skus),
    readBranchPrices(branchKey, currency, skus),
  ]);
  return {
    rows: page.map((i) => ({ sku: i.sku, name: { ...i.name }, availableQuantity: quantities.get(i.sku) ?? null, priceCent: prices.get(i.sku) ?? null })),
    total: assigned.length,
    offset,
    limit,
    currency,
  };
}

async function writeQuantity(channelId: string, branchKey: string, sku: string, quantity: number): Promise<void> {
  await retryOnConflict(async () => {
    const { body } = await adminRoot.inventory().get({ queryArgs: { where: 'sku=:sku and supplyChannel(id=:channel)', 'var.sku': sku, 'var.channel': channelId, limit: 1 } }).execute();
    const existing = body.results[0];
    if (!existing) {
      await adminRoot
        .inventory()
        .post({ body: { key: inventoryKey(sku, branchKey), sku, quantityOnStock: quantity, supplyChannel: { typeId: 'channel', id: channelId } } })
        .execute();
      return;
    }
    if (existing.quantityOnStock === quantity) return;
    await adminRoot.inventory().withId({ ID: existing.id }).post({ body: { version: existing.version, actions: [{ action: 'changeQuantity', quantity }] } }).execute();
  });
}

export interface StockChange {
  availableQuantity?: number;
  /** Cents; `null` clears the branch price. */
  priceCent?: number | null;
}

export async function setBranchStock(storeKey: string, branchKey: string, sku: string, change: StockChange): Promise<StockRow> {
  const live = !devFixturesEnabled();
  const channel = live ? await requireBranchOfStore(storeKey, branchKey) : null;
  if (!live) await assertBranchOfStore(storeKey, branchKey);
  if (!(await isAssigned(storeKey, sku))) throw new UnprocessableError('This part is not in your assortment', 'SKU_NOT_IN_ASSORTMENT');
  if (change.availableQuantity !== undefined && (!Number.isInteger(change.availableQuantity) || change.availableQuantity < 0 || change.availableQuantity > STOCK_MAX)) {
    throw new ApiError(400, `Stock must be a whole number from 0 to ${STOCK_MAX}`);
  }
  const currency = currencyOfBranch(channel?.address?.country ?? (await fixtureStock.branchCountry(storeKey, branchKey)));
  if (change.availableQuantity !== undefined) {
    if (channel) await writeQuantity(channel.id, branchKey, sku, change.availableQuantity);
    else await fixtureStock.setQuantity(storeKey, branchKey, sku, change.availableQuantity);
  }
  if (change.priceCent !== undefined) await setStandalonePrice(storeKey, sku, branchKey, change.priceCent, currency);
  const [quantities, prices] = await Promise.all([channel ? readQuantities(channel.id, [sku]) : fixtureStock.quantities(storeKey, branchKey, [sku]), readBranchPrices(branchKey, currency, [sku])]);
  const info = (await assignedBySku(storeKey)).get(sku);
  return { sku, name: { ...(info?.name ?? {}) }, availableQuantity: quantities.get(sku) ?? null, priceCent: prices.get(sku) ?? null };
}
