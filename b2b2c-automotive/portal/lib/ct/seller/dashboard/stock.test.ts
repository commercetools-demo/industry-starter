import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { countOutOfStockEverywhere, lowStockByBranch } from './stock';

const channel = (id: string, roles: string[]) => ({ obj: { id, key: `key-${id}`, roles, name: { 'en-US': `Branch ${id}` } } });
const store = { supplyChannels: [channel('wh', ['InventorySupply']), channel('b1', ['InventorySupply', 'ProductDistribution']), channel('b2', ['InventorySupply', 'ProductDistribution'])] };

const stock: Record<string, Array<[string, number]>> = {
  b1: [['S1', 0], ['S2', 0], ['S3', 2], ['S4', 3], ['S5', 4], ['S6', 5], ['S7', 5], ['S9', 40]],
  b2: [['S1', 0], ['S2', 9], ['S3', 1]],
  wh: [['S2', 500]],
};

function inventory(call: { queryArgs: Record<string, unknown> }) {
  const where = String(call.queryArgs.where);
  const id = /supplyChannel\(id="([^"]+)"\)/.exec(where)?.[1] ?? '';
  const low = /availableQuantity <= (\d+)/.exec(where);
  const rows = (stock[id] ?? []).filter(([, q]) => (low ? q <= Number(low[1]) : true)).sort((a, b) => a[1] - b[1]);
  return { results: rows.map(([sku, availableQuantity]) => ({ sku, availableQuantity, supplyChannel: { id } })) };
}

beforeEach(() => {
  adminMock.reset();
  adminMock.respond('stores', store);
  adminMock.respond('inventory', inventory);
  adminMock.respond('productProjections', {
    results: [
      { name: { 'en-US': 'Brake pad' }, masterVariant: { sku: 'S1' }, variants: [{ sku: 'S2' }] },
      { name: { 'en-US': 'Oil filter' }, masterVariant: { sku: 'S3' }, variants: [] },
    ],
  });
});

describe('dashboard stock', () => {
  it('low stock top five per branch; out of stock everywhere counts only parts at 0 in every branch', async () => {
    const rows = await lowStockByBranch('store-a');
    expect(rows.map((r) => r.branch.key)).toEqual(['key-b1', 'key-b2']); // the warehouse is not a branch
    expect(rows[0].parts).toHaveLength(5);
    expect(rows[0].parts.map((p) => p.sku)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
    expect(rows[0].parts[0]).toMatchObject({ available: 0, name: { 'en-US': 'Brake pad' } });
    expect(rows[1].parts.map((p) => p.sku)).toEqual(['S1', 'S3']);
    // S1 is 0 in both branches; S2 is 0 in b1 but 9 in b2, so it does not count
    expect(await countOutOfStockEverywhere('store-a')).toBe(1);
  });

  it('no N+1: one store read, one inventory request per branch, one batched product lookup', async () => {
    await lowStockByBranch('store-a');
    expect(adminMock.callsTo('stores')).toHaveLength(1);
    expect(adminMock.callsTo('inventory')).toHaveLength(2);
    expect(adminMock.callsTo('productProjections')).toHaveLength(1);
    expect(adminMock.callsTo('stores')[0]).toMatchObject({ storeKey: 'store-a' });
  });

  it('a store without branches gives empty results and no inventory request', async () => {
    adminMock.respond('stores', { supplyChannels: [channel('wh', ['InventorySupply'])] });
    expect(await lowStockByBranch('store-a')).toEqual([]);
    expect(await countOutOfStockEverywhere('store-a')).toBe(0);
    expect(adminMock.callsTo('inventory')).toHaveLength(0);
  });
});
