// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE_SOHO, ctCart, ctLine, usd } from '@/test/cart';

const m = vi.hoisted(() => ({
  projections: vi.fn(),
  inventory: vi.fn(),
  capsules: vi.fn(),
  queryArgs: [] as Record<string, unknown>[],
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    productProjections: () => ({
      get: (opts: { queryArgs: Record<string, unknown> }) => ({
        execute: async () => {
          m.queryArgs.push(opts.queryArgs);
          return { body: { results: await m.projections() } };
        },
      }),
    }),
  },
}));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: m.inventory, SKU_PATTERN: /.*/ }));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: async () => [STORE_SOHO] }));
vi.mock('@/lib/ct/shipping', () => ({ getFreeShippingThreshold: async () => ({ centAmount: 7500, currencyCode: 'USD' }) }));
vi.mock('@/lib/ct/attribute-labels', () => ({ getAttributeLabels: async () => ({ grind: { 'whole-bean': 'Whole bean' } }) }));
vi.mock('@/lib/ct/product-detail', () => ({ getRecurrencePolicies: async () => [{ id: 'rp-2w', key: 'k', name: 'n', schedule: { unit: 'Weeks', value: 2 } }] }));
vi.mock('@/lib/related', () => ({ getCompatibleCapsules: m.capsules }));

import { getCartEnrichment } from '@/lib/ct/cart-enrich';

const ctx = { locale: 'en-US', country: 'US', currency: 'USD' };
const projection = (id: string, typeKey: string, attrs: Record<string, unknown> = {}, sku = `S-${id}`) => ({
  id, productType: { typeId: 'product-type', id: 'pt', obj: { key: typeKey } },
  attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
  masterVariant: { id: 1, sku, attributes: [], price: { value: { centAmount: 1000, currencyCode: 'USD' } } },
  variants: [],
});

beforeEach(() => {
  m.projections.mockReset();
  m.inventory.mockReset();
  m.capsules.mockReset();
  m.queryArgs.length = 0;
});

describe('getCartEnrichment', () => {
  it('one projection call and one inventory call for many lines', async () => {
    m.projections.mockResolvedValue([projection('p1', 'mcf-pods', { intensity: 8 }, 'S1'), projection('p2', 'mcf-coffee', {}, 'S2')]);
    m.inventory.mockResolvedValue({ S1: { online: 5, stores: {} }, S2: { online: 1, stores: {} } });
    const cart = ctCart({
      lines: [ctLine({ id: 'a', sku: 'S1', productId: 'p1' }), ctLine({ id: 'b', sku: 'S2', productId: 'p2' }), ctLine({ id: 'c', sku: 'S1', productId: 'p1', fulfilment: 'collect', channelId: 'ch-soho' })],
    });
    const out = await getCartEnrichment(cart, ctx);
    expect(m.projections).toHaveBeenCalledTimes(1);
    expect(m.inventory).toHaveBeenCalledTimes(1);
    expect(m.inventory).toHaveBeenCalledWith(['S1', 'S2']);
    expect(m.queryArgs[0]).toMatchObject({ where: 'id in ("p1", "p2")', staged: false, priceCurrency: 'USD', priceCountry: 'US', expand: ['productType'] });
    expect(out.products.p1).toMatchObject({ shape: 'pods', variants: { S1: { attrs: { intensity: 8 }, currentPrice: usd(1000) } } });
    expect(out.products.p2.shape).toBe('coffee');
    expect(out.threshold).toEqual(usd(7500));
    expect(out.stores).toHaveLength(1);
  });

  it('empty cart makes no enrichment calls', async () => {
    const out = await getCartEnrichment(ctCart({ lines: [] }), ctx);
    expect(m.projections).not.toHaveBeenCalled();
    expect(m.inventory).not.toHaveBeenCalled();
    expect(out.products).toEqual({});
  });

  it('a failed inventory read gives null, not a failed cart', async () => {
    m.projections.mockResolvedValue([projection('p1', 'mcf-pods')]);
    m.inventory.mockRejectedValue(new Error('down'));
    const out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'S-p1', productId: 'p1' })] }), ctx);
    expect(out.inventory).toBeNull();
  });

  it('a failed projection read keeps the cart readable', async () => {
    m.projections.mockRejectedValue(new Error('down'));
    m.inventory.mockResolvedValue({});
    const out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'S1', productId: 'p1' })] }), ctx);
    expect(out.products).toEqual({});
  });

  it('subscribe lines bring the recurrence schedules', async () => {
    m.projections.mockResolvedValue([projection('p1', 'mcf-pods')]);
    m.inventory.mockResolvedValue({});
    const out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'S-p1', productId: 'p1', fulfilment: 'subscribe', policyId: 'rp-2w' })] }), ctx);
    expect(out.policies).toEqual({ 'rp-2w': { unit: 'Weeks', value: 2 } });
  });

  it('Starter capsules suggestion: a Vertuo machine without capsules gets the first compatible capsule', async () => {
    m.projections.mockResolvedValue([projection('m1', 'mcf-machine', { system: { key: 'vertuo', label: 'Vertuo' } }, 'MAC')]);
    m.inventory.mockResolvedValue({});
    m.capsules.mockResolvedValue([{ sku: 'V-10', name: 'Vertuo starter', price: { from: usd(1090) } }]);
    const out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'MAC', productId: 'm1' })] }), ctx);
    expect(m.capsules).toHaveBeenCalledWith({ shape: 'machine', systemKey: 'vertuo' }, expect.objectContaining({ country: 'US' }));
    expect(out.nudge).toEqual({ sku: 'V-10', name: 'Vertuo starter', price: usd(1090), machineName: 'Product MAC' });
  });

  it('no nudge for non-capsule machines or when capsules are present', async () => {
    m.inventory.mockResolvedValue({});
    m.projections.mockResolvedValue([projection('m1', 'mcf-machine', { system: { key: 'bean-to-cup', label: 'x' } }, 'MAC')]);
    let out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'MAC', productId: 'm1' })] }), ctx);
    expect(out.nudge).toBeNull();
    expect(m.capsules).not.toHaveBeenCalled();

    m.projections.mockResolvedValue([
      projection('m1', 'mcf-machine', { system: { key: 'vertuo', label: 'x' } }, 'MAC'),
      projection('p1', 'mcf-pods', { system: { key: 'vertuo', label: 'x' } }, 'POD'),
    ]);
    out = await getCartEnrichment(ctCart({ lines: [ctLine({ id: 'a', sku: 'MAC', productId: 'm1' }), ctLine({ id: 'b', sku: 'POD', productId: 'p1' })] }), ctx);
    expect(out.nudge).toBeNull();
    expect(m.capsules).not.toHaveBeenCalled();
  });
});
