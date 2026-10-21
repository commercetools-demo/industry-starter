// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  search: vi.fn(),
  projection: vi.fn(),
  withId: vi.fn(),
  inventory: vi.fn(),
  policies: vi.fn(),
}));
vi.mock('@/lib/ct/public-cache', () => ({ cachedPublic: (_k: string, _p: string[], fn: unknown) => fn }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    products: () => ({ search: () => ({ post: (a: unknown) => ({ execute: () => h.search(a) }) }) }),
    productProjections: () => ({ withId: (a: unknown) => ({ get: (q: unknown) => ({ execute: () => h.projection(a, q) }) }) }),
    inventory: () => ({ get: (q: unknown) => ({ execute: () => h.inventory(q) }) }),
    recurrencePolicies: () => ({
      get: (q: unknown) => ({ execute: () => h.policies(q) }),
      withKey: (k: unknown) => ({ get: () => ({ execute: () => h.policies(k) }) }),
    }),
  },
}));

import { getInventoryDetail } from '@/lib/ct/inventory';
import { getProductBySku, getRecurrencePolicies, getRecurrencePolicyByKey } from '@/lib/ct/product-detail';

const ctx = { locale: 'en-US', country: 'US', currency: 'USD' };

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
});

describe('getProductBySku', () => {
  it('sku lookup uses Product Search then the projection with the same price context', async () => {
    h.search.mockResolvedValue({ body: { results: [{ id: 'prod-1' }] } });
    h.projection.mockResolvedValue({ body: { id: 'prod-1' } });
    const p = await getProductBySku('POD-10', ctx);
    expect(p).toEqual({ id: 'prod-1' });
    expect(h.search.mock.calls[0]?.[0]).toMatchObject({ body: { query: { exact: { field: 'variants.sku', value: 'POD-10' } }, limit: 1 } });
    const [id, query] = h.projection.mock.calls[0] as [{ ID: string }, { queryArgs: Record<string, unknown> }];
    expect(id).toEqual({ ID: 'prod-1' });
    expect(query.queryArgs).toMatchObject({ staged: false, priceCurrency: 'USD', priceCountry: 'US', localeProjection: ['en-US'] });
    expect(JSON.stringify(query.queryArgs.expand)).not.toContain('recurrencePrices');
    expect(query.queryArgs.expand).toContain('productType');
  });

  it('invalid sku is not found before any call', async () => {
    expect(await getProductBySku('x" or 1=1', ctx)).toBeNull();
    expect(await getProductBySku('', ctx)).toBeNull();
    expect(h.search).not.toHaveBeenCalled();
  });

  it('unknown product returns null', async () => {
    h.search.mockResolvedValue({ body: { results: [] } });
    expect(await getProductBySku('NOPE-1', ctx)).toBeNull();
    h.search.mockResolvedValue({ body: { results: [{ id: 'gone' }] } });
    h.projection.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getProductBySku('NOPE-2', ctx)).toBeNull();
  });

  it('other projection failures are thrown', async () => {
    h.search.mockResolvedValue({ body: { results: [{ id: 'p' }] } });
    h.projection.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(getProductBySku('POD-10', ctx)).rejects.toThrow('boom');
  });
});

describe('getInventoryDetail', () => {
  it('inventory detail maps online and store entries and restock fields', async () => {
    h.inventory.mockResolvedValue({
      body: {
        results: [
          { sku: 'A', availableQuantity: 0, restockableInDays: 5, expectedDelivery: '2026-11-02T00:00:00.000Z', minCartQuantity: 2, maxCartQuantity: 10 },
          { sku: 'A', availableQuantity: 4, supplyChannel: { typeId: 'channel', id: 'ch-1' } },
          { sku: 'B', availableQuantity: 9, supplyChannel: { typeId: 'channel', id: 'ch-2' } },
        ],
      },
    });
    const out = await getInventoryDetail(['A', 'B', 'A']);
    expect(out.A).toEqual({ online: 0, restockableInDays: 5, expectedDelivery: '2026-11-02T00:00:00.000Z', minQty: 2, maxQty: 10, stores: { 'ch-1': 4 } });
    expect(out.B).toEqual({ online: 0, stores: { 'ch-2': 9 } });
    expect((h.inventory.mock.calls[0]?.[0] as { queryArgs: { where: string } }).queryArgs.where).toBe('sku in ("A", "B")');
  });

  it('rejects an unsafe sku and skips the call for none', async () => {
    await expect(getInventoryDetail(['a" or sku<>"'])).rejects.toMatchObject({ code: 'validation_failed' });
    expect(await getInventoryDetail([])).toEqual({});
    expect(h.inventory).not.toHaveBeenCalled();
  });
});

describe('recurrence policies', () => {
  it('maps standard schedules and skips day-of-month ones', async () => {
    h.policies.mockResolvedValue({
      body: {
        results: [
          { id: 'r1', key: 'mcf-every-month', name: { 'en-US': 'Every month' }, schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } },
          { id: 'r2', key: 'x', schedule: { type: 'dayOfMonth', dayOfMonth: 3 } },
        ],
      },
    });
    expect(await getRecurrencePolicies('en-US')).toEqual([
      { id: 'r1', key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } },
    ]);
  });

  it('policy by key is null on 404', async () => {
    h.policies.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getRecurrencePolicyByKey('nope', 'en-US')).toBeNull();
  });
});
