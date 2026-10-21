// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  product: vi.fn(), inventory: vi.fn(), policies: vi.fn(), cacheCalls: 0,
}));
// A memoising stand-in for React's request-scoped cache(): one result per argument list.
vi.mock('react', () => ({
  cache: <A extends unknown[], R>(fn: (...a: A) => R) => {
    const memo = new Map<string, R>();
    return (...a: A): R => {
      const k = JSON.stringify(a);
      if (!memo.has(k)) memo.set(k, fn(...a));
      return memo.get(k) as R;
    };
  },
}));
vi.mock('@/lib/ct/product-detail', () => ({ getProductBySku: h.product, getRecurrencePolicies: h.policies }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: h.inventory }));
vi.mock('@/lib/ct/attribute-labels', () => ({ getAttributeLabels: async () => ({}) }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => [] }));
vi.mock('@/lib/ct/shipping', () => ({ getFreeShippingThreshold: async () => ({ centAmount: 7500, currencyCode: 'USD' }) }));

import { loadProductPage } from '@/lib/pdp/load';

const projection = (subscribable = true, type = 'mcf-pods') => ({
  id: 'p1', productType: { obj: { key: type } }, name: { 'en-US': 'Ember' }, slug: { 'en-US': 'ember' }, categories: [],
  attributes: [{ name: 'subscribable', value: subscribable }],
  masterVariant: { id: 1, sku: 'A', attributes: [], images: [], price: { id: 'x', value: { currencyCode: 'USD', centAmount: 500 } } },
  variants: [],
});

beforeEach(() => {
  for (const f of [h.product, h.inventory, h.policies]) f.mockReset();
  h.inventory.mockResolvedValue({ A: { online: 3, stores: {} } });
  h.policies.mockResolvedValue([{ id: 'r1', key: 'k', name: 'Every month', schedule: { unit: 'Months', value: 1 } }]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadProductPage', () => {
  it('metadata and page share one cached load', async () => {
    h.product.mockResolvedValue(projection());
    const [a, b] = await Promise.all([loadProductPage('A', 'en-US'), loadProductPage('A', 'en-US')]);
    expect(a).toBe(b);
    expect(h.product).toHaveBeenCalledTimes(1);
    expect(h.product.mock.calls[0]?.[1]).toEqual({ locale: 'en-US', country: 'US', currency: 'USD' });
  });

  it('metadata uses the same market context as the page', async () => {
    h.product.mockResolvedValue(projection());
    const data = await loadProductPage('A-CA', 'en-CA');
    expect(h.product.mock.calls[0]?.[1]).toEqual({ locale: 'en-CA', country: 'CA', currency: 'CAD' });
    expect(data?.collection).toBe(false);
    expect(data?.currency).toBe('CAD');
  });

  it('unknown product returns null', async () => {
    h.product.mockResolvedValue(null);
    expect(await loadProductPage('NOPE', 'en-US')).toBeNull();
  });

  it('inventory failure still renders and is flagged, never claiming stock', async () => {
    h.product.mockResolvedValue(projection());
    h.inventory.mockRejectedValue(new Error('down'));
    const data = await loadProductPage('A-INV', 'en-US');
    expect(data?.inventoryFailed).toBe(true);
    expect(data?.product.variants[0]?.stock).toEqual({ online: 0, stores: {} });
  });

  it('policy failure hides the subscribe policies; machines get none', async () => {
    h.product.mockResolvedValue(projection());
    h.policies.mockRejectedValue(new Error('down'));
    expect((await loadProductPage('A-POL', 'en-US'))?.policies).toEqual([]);
    h.policies.mockResolvedValue([{ id: 'r1', key: 'k', name: 'n', schedule: { unit: 'Months', value: 1 } }]);
    h.product.mockResolvedValue(projection(true, 'mcf-machine'));
    expect((await loadProductPage('M', 'en-US'))?.policies).toEqual([]);
    h.product.mockResolvedValue(projection(true));
    expect((await loadProductPage('B', 'en-US'))?.policies).toHaveLength(1);
  });
});
