// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, get } = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, get: vi.fn(() => ({ execute })) };
});
vi.mock('@/lib/ct/client', () => ({ apiRoot: { inventory: () => ({ get }) } }));

import { getAvailabilityForSkus, getStoreAvailability } from '@/lib/ct/inventory';

const STORES = [
  { id: 'c-soho', key: 'mcf-store-nyc-soho' },
  { id: 'c-bk', key: 'mcf-store-nyc-brooklyn' },
];
const entry = (sku: string, qty: number, channel?: string) => ({
  sku, availableQuantity: qty, ...(channel ? { supplyChannel: { typeId: 'channel', id: channel } } : {}),
});

beforeEach(() => {
  execute.mockReset();
  get.mockClear();
});

describe('getStoreAvailability', () => {
  it('Collect at an empty store is shown unavailable and ship still available', async () => {
    execute.mockResolvedValue({ body: { results: [entry('S1', 40), entry('S1', 0, 'c-soho')] } });
    const a = await getStoreAvailability('S1', STORES);
    expect(a.ship).toBe('in');
    expect(a.stores).toEqual([
      { storeKey: 'mcf-store-nyc-soho', quantity: 0, state: 'out' },
      { storeKey: 'mcf-store-nyc-brooklyn', quantity: 0, state: 'out' }, // entry missing is out too
    ]);
  });

  it('low stock threshold', async () => {
    execute.mockResolvedValue({ body: { results: [entry('S1', 3), entry('S1', 5, 'c-soho'), entry('S1', 6, 'c-bk')] } });
    const a = await getStoreAvailability('S1', STORES);
    expect(a.ship).toBe('low');
    expect(a.stores.map((s) => s.state)).toEqual(['low', 'in']);
  });

  it('invalid sku rejected before the predicate', async () => {
    await expect(getStoreAvailability('x" or sku<>"', STORES)).rejects.toMatchObject({ code: 'validation_failed' });
    await expect(getStoreAvailability('', STORES)).rejects.toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it('unknown sku returns all out', async () => {
    execute.mockResolvedValue({ body: { results: [] } });
    const a = await getStoreAvailability('NOPE', STORES);
    expect(a.ship).toBe('out');
    expect(a.stores.every((s) => s.state === 'out')).toBe(true);
  });

  it('builds the sku predicate', async () => {
    execute.mockResolvedValue({ body: { results: [] } });
    await getStoreAvailability('MC-1.A', STORES);
    expect(get).toHaveBeenCalledWith({ queryArgs: { where: 'sku="MC-1.A"', limit: 100 } });
  });
});

describe('getAvailabilityForSkus', () => {
  it('groups one read by sku', async () => {
    execute.mockResolvedValue({ body: { results: [entry('A', 10), entry('B', 0), entry('B', 9, 'c-bk')] } });
    const out = await getAvailabilityForSkus(['A', 'B', 'A'], STORES);
    expect(out.map((o) => [o.sku, o.ship])).toEqual([['A', 'in'], ['B', 'out']]);
    expect(out[1].stores[1].state).toBe('in');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
