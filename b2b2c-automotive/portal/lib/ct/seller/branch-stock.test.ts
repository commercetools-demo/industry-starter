// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Obj = Record<string, unknown>;
let inventory: { id: string; sku: string; version: number; quantityOnStock: number; availableQuantity: number; channel: string }[];
const inventoryPosts: Obj[] = [];
const inventoryUpdates: { id: string; body: { version: number; actions: Obj[] } }[] = [];
let updateConflicts = 0;
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: {
    inventory: () => ({
      get: ({ queryArgs }: { queryArgs: Record<string, unknown> }) => ({
        execute: async () => {
          const channel = queryArgs['var.channel'];
          const skus = (queryArgs['var.skus'] as string[] | undefined) ?? [queryArgs['var.sku'] as string];
          return { body: { results: inventory.filter((e) => e.channel === channel && skus.includes(e.sku)) } };
        },
      }),
      post: ({ body }: { body: Obj }) => ({
        execute: async () => {
          inventoryPosts.push(body);
          inventory.push({ id: `inv-${inventory.length}`, sku: body.sku as string, version: 1, quantityOnStock: body.quantityOnStock as number, availableQuantity: body.quantityOnStock as number, channel: (body.supplyChannel as { id: string }).id });
          return { body: {} };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        post: ({ body }: { body: { version: number; actions: Obj[] } }) => ({
          execute: async () => {
            inventoryUpdates.push({ id: ID, body });
            const entry = inventory.find((e) => e.id === ID) as (typeof inventory)[number];
            if (updateConflicts > 0) {
              updateConflicts -= 1;
              entry.version += 1;
              throw { statusCode: 409 };
            }
            const quantity = (body.actions[0] as { quantity: number }).quantity;
            entry.quantityOnStock = quantity;
            entry.availableQuantity = quantity;
            entry.version += 1;
            return { body: {} };
          },
        }),
      }),
    }),
  },
}));

const prices: { key: string; sku: string; value: { centAmount: number; currencyCode: string } }[] = [];
vi.mock('./catalog-root', () => ({
  catalogRoot: async () => ({ standalonePrices: () => ({ get: ({ queryArgs }: { queryArgs: Record<string, unknown> }) => ({ execute: async () => ({ body: { results: prices.filter((p) => (queryArgs['var.skus'] as string[]).includes(p.sku)) } }) }) }) }),
}));

const setStandalonePrice = vi.fn(async (_s: string, _sku: string, _c: string | undefined, _cents: number | null, _cur: string) => 'created' as const);
vi.mock('./prices', () => ({ setStandalonePrice: (...a: [string, string, string | undefined, number | null, string]) => setStandalonePrice(...a) }));

const assigned = new Map([
  ['MLV-BP-41001', { sku: 'MLV-BP-41001', name: { 'en-US': 'Brake pads' } }],
  ['MLV-BD-42001', { sku: 'MLV-BD-42001', name: { 'en-US': 'Brake disc' } }],
]);
vi.mock('./assortment', () => ({ assignedBySku: async () => assigned, isAssigned: async (_s: string, sku: string) => assigned.has(sku) }));

const branches: Record<string, { id: string; key: string; address: { country: string } }> = {
  'mau-br-north-hamburg': { id: 'ch-hh', key: 'mau-br-north-hamburg', address: { country: 'DE' } },
  'mau-br-south-austin': { id: 'ch-au', key: 'mau-br-south-austin', address: { country: 'US' } },
};
const branchGuard = vi.fn(async (_store: string, key: string) => {
  const found = branches[key];
  if (!found) throw Object.assign(new Error('Not found'), { status: 404 });
  return found;
});
vi.mock('./branches', () => ({ requireBranchOfStore: (s: string, k: string) => branchGuard(s, k), assertBranchOfStore: (s: string, k: string) => branchGuard(s, k) }));

import { currencyOfBranch, inventoryKey, listBranchStock, setBranchStock } from './branch-stock';

beforeEach(() => {
  inventory = [{ id: 'inv-seed', sku: 'MLV-BP-41001', version: 2, quantityOnStock: 12, availableQuantity: 12, channel: 'ch-hh' }];
  prices.length = 0;
  prices.push({ key: 'MLV-BP-41001__mau-br-north-hamburg', sku: 'MLV-BP-41001', value: { centAmount: 8900, currencyCode: 'EUR' } });
  prices.push({ key: 'MLV-BP-41001__mau-dist-north', sku: 'MLV-BP-41001', value: { centAmount: 9900, currencyCode: 'EUR' } });
  inventoryPosts.length = 0;
  inventoryUpdates.length = 0;
  updateConflicts = 0;
  setStandalonePrice.mockClear();
  branchGuard.mockClear();
});

describe('branch stock', () => {
  it('lists the assigned parts with stock and the BRANCH price only (the store price is not shown as a branch price)', async () => {
    const page = await listBranchStock('mau-reseller-north', 'mau-br-north-hamburg');
    expect(page.currency).toBe('EUR');
    expect(page.total).toBe(2);
    expect(page.rows[0]).toMatchObject({ sku: 'MLV-BD-42001', availableQuantity: null, priceCent: null });
    expect(page.rows[1]).toMatchObject({ sku: 'MLV-BP-41001', availableQuantity: 12, priceCent: 8900 });
  });

  it('a branch of another store is refused before anything is read', async () => {
    await expect(listBranchStock('mau-reseller-north', 'mau-br-south-foreign')).rejects.toMatchObject({ status: 404 });
    await expect(setBranchStock('mau-reseller-north', 'mau-br-south-foreign', 'MLV-BP-41001', { availableQuantity: 1 })).rejects.toMatchObject({ status: 404 });
    expect(inventoryPosts).toHaveLength(0);
    expect(setStandalonePrice).not.toHaveBeenCalled();
  });

  it('stock writes an inventory entry on the branch supply channel: create when absent', async () => {
    const row = await setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BD-42001', { availableQuantity: 7 });
    expect(inventoryPosts[0]).toEqual({ key: 'mau-inv-MLV-BD-42001-north-hamburg', sku: 'MLV-BD-42001', quantityOnStock: 7, supplyChannel: { typeId: 'channel', id: 'ch-hh' } });
    expect(row.availableQuantity).toBe(7);
  });

  it('then changeQuantity with the current version, a 409 retried with the latest version', async () => {
    updateConflicts = 1;
    const row = await setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BP-41001', { availableQuantity: 3 });
    expect(inventoryUpdates).toHaveLength(2);
    expect(inventoryUpdates[0].body).toEqual({ version: 2, actions: [{ action: 'changeQuantity', quantity: 3 }] });
    expect(inventoryUpdates[1].body.version).toBe(3);
    expect(row.availableQuantity).toBe(3);
  });

  it('branch price calls setStandalonePrice with the branch channel key and the branch currency (the seed key scheme lives in T)', async () => {
    await setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BP-41001', { priceCent: 9100 });
    expect(setStandalonePrice).toHaveBeenCalledWith('mau-reseller-north', 'MLV-BP-41001', 'mau-br-north-hamburg', 9100, 'EUR');
    await setBranchStock('mau-reseller-south', 'mau-br-south-austin', 'MLV-BP-41001', { priceCent: 5500 });
    expect(setStandalonePrice).toHaveBeenLastCalledWith('mau-reseller-south', 'MLV-BP-41001', 'mau-br-south-austin', 5500, 'USD');
  });

  it('clearing the price calls the writer with null so the store price applies; it never touches inventory', async () => {
    await setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BP-41001', { priceCent: null });
    expect(setStandalonePrice).toHaveBeenCalledWith('mau-reseller-north', 'MLV-BP-41001', 'mau-br-north-hamburg', null, 'EUR');
    expect(inventoryPosts).toHaveLength(0);
    expect(inventoryUpdates).toHaveLength(0);
  });

  it('SKU outside the assortment 422, nothing written', async () => {
    await expect(setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'NOT-MINE', { availableQuantity: 1, priceCent: 100 })).rejects.toMatchObject({ status: 422, code: 'SKU_NOT_IN_ASSORTMENT' });
    expect(inventoryPosts).toHaveLength(0);
    expect(setStandalonePrice).not.toHaveBeenCalled();
  });

  it('a quantity outside 0..100000 is refused; price validation (zero, negative) is the price writer and no floor check exists here', async () => {
    await expect(setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BP-41001', { availableQuantity: -1 })).rejects.toMatchObject({ status: 400 });
    await expect(setBranchStock('mau-reseller-north', 'mau-br-north-hamburg', 'MLV-BP-41001', { availableQuantity: 100001 })).rejects.toMatchObject({ status: 400 });
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('./branch-stock.ts', import.meta.url), 'utf8'));
    expect(source).not.toMatch(/assertAboveFloor|map-floor|minPrice|floorCent/);
  });

  it('helpers: US branches use USD, inventory keys follow the seed pattern', () => {
    expect(currencyOfBranch('US')).toBe('USD');
    expect(currencyOfBranch('DE')).toBe('EUR');
    expect(inventoryKey('MLV-BP-41001', 'mau-br-north-hamburg')).toBe('mau-inv-MLV-BP-41001-north-hamburg');
  });
});
