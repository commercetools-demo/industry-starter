import { describe, expect, it } from 'vitest';
import { detectPriceChanges, fulfilmentOf, mapCart } from '@/lib/mappers/cart';
import { STORE_BK, STORE_SOHO, ctCart, ctLine, enrichment, usd, vt } from '@/test/cart';

const ctx = { locale: 'en-US', t: vt, collection: true } as const;
const pod = { shape: 'pods' as const, variants: { 'POD-10': { attrs: { intensity: 8, capsulesPerPack: 10 }, labels: {}, currentPrice: usd(1000) } } };

describe('mapCart', () => {
  it('Quantity changed: totals are the engine values verbatim', () => {
    // Deliberately odd numbers: the mapper must not recompute total, tax or shipping from the lines.
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', quantity: 3, cents: 1000 })], shippingCents: 777, taxCents: 123, totalCents: 4321 });
    const view = mapCart(cart, enrichment(), ctx);
    expect(view.total).toEqual(usd(4321));
    expect(view.tax).toEqual({ amount: usd(123), included: false });
    expect(view.shipping).toEqual({ amount: usd(777), isFree: false });
    expect(view.count).toBe(3);
  });

  it('subtotal and discount are sums of engine line fields', () => {
    const lines = [
      ctLine({ id: 'a', sku: 'S1', quantity: 2, cents: 1000, totalCents: 1800 }), // cart discount allocated by the engine
      ctLine({ id: 'b', sku: 'S2', quantity: 1, cents: 500 }),
    ];
    const view = mapCart(ctCart({ lines }), enrichment(), ctx);
    expect(view.subtotal).toEqual(usd(2300));
    expect(view.discount).toEqual(usd(200));
    expect(mapCart(ctCart({ lines: [lines[1]] }), enrichment(), ctx).discount).toBeNull();
  });

  it('fulfilment read from the custom field and derived when missing', () => {
    expect(fulfilmentOf(ctLine({ id: 'a', sku: 'S', fulfilment: 'collect', channelId: 'ch-soho' }))).toBe('collect');
    expect(fulfilmentOf(ctLine({ id: 'a', sku: 'S', fulfilment: null, channelId: 'ch-soho' }))).toBe('collect');
    expect(fulfilmentOf(ctLine({ id: 'a', sku: 'S', fulfilment: null, policyId: 'rp' }))).toBe('subscribe');
    expect(fulfilmentOf(ctLine({ id: 'a', sku: 'S', fulfilment: null }))).toBe('delivery');
  });

  it('collect line gets the store and readiness', () => {
    const view = mapCart(ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', fulfilment: 'collect', channelId: 'ch-bk' })] }), enrichment(), ctx);
    expect(view.lines[0].store).toMatchObject({ key: STORE_BK.key, name: 'Malva Brooklyn', collectionMinutes: 15 });
    expect(view.lines[0].groupKey).toBe(`collect:${STORE_BK.key}`);
    expect(view.groups[0]).toMatchObject({ kind: 'collect', lineIds: ['a'] });
  });

  it('every line has fulfilment groupKey and store for collect', () => {
    const lines = [
      ctLine({ id: 'c', sku: 'S1', fulfilment: 'collect', channelId: 'ch-soho' }),
      ctLine({ id: 'd', sku: 'S2' }),
      ctLine({ id: 's', sku: 'S3', fulfilment: 'subscribe', policyId: 'rp-1' }),
    ];
    const view = mapCart(ctCart({ lines }), enrichment({ policies: { 'rp-1': { unit: 'Weeks', value: 2 } } }), ctx);
    expect(view.lines.map((l) => [l.fulfilment, l.groupKey, Boolean(l.store)])).toEqual([
      ['collect', `collect:${STORE_SOHO.key}`, true], ['delivery', 'delivery', false], ['subscribe', 'subscribe', false],
    ]);
    expect(view.lines[2].recurrence).toEqual({ policyId: 'rp-1', schedule: { unit: 'Weeks', value: 2 } });
    expect(view.groups.map((g) => g.key)).toEqual([`collect:${STORE_SOHO.key}`, 'delivery', 'subscribe']);
  });

  it('price-updated flag from price difference', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', cents: 900 })] });
    const e = enrichment({ products: { 'p-POD-10': pod } });
    const changes = detectPriceChanges(cart, e);
    expect(changes).toEqual({ a: usd(900) });
    const view = mapCart(cart, e, { ...ctx, previousPrices: changes });
    expect(view.lines[0].notices).toEqual([{ kind: 'price-updated', previous: usd(900) }]);
    expect(view.canCheckout).toBe(true); // a price change never blocks
    expect(detectPriceChanges(ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', cents: 1000 })] }), e)).toEqual({});
  });

  it('a stored priceWas field keeps the mark across reloads', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', cents: 1000, custom: { priceWas: 900 } })] });
    expect(mapCart(cart, enrichment(), ctx).lines[0].notices).toEqual([{ kind: 'price-updated', previous: usd(900) }]);
  });

  it('subscribe lines are not price checked against the one-time price', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', cents: 900, fulfilment: 'subscribe', policyId: 'rp' })] });
    expect(detectPriceChanges(cart, enrichment({ products: { 'p-POD-10': pod } }))).toEqual({});
  });

  it('out-of-stock and collect-unavailable flags', () => {
    const lines = [
      ctLine({ id: 'a', sku: 'S1' }),
      ctLine({ id: 'b', sku: 'S2', fulfilment: 'collect', channelId: 'ch-soho' }),
      ctLine({ id: 'c', sku: 'S3', quantity: 5 }),
    ];
    const inventory = {
      S1: { online: 0, stores: {} }, S2: { online: 9, stores: { 'ch-soho': 0 } }, S3: { online: 3, stores: {} },
    };
    const view = mapCart(ctCart({ lines }), enrichment({ inventory }), ctx);
    expect(view.lines[0].notices).toEqual([{ kind: 'out-of-stock' }]);
    expect(view.lines[1].notices).toEqual([{ kind: 'collect-unavailable' }]);
    expect(view.lines[2].notices).toEqual([{ kind: 'quantity-exceeds-stock', available: 3 }]);
    expect(view.lines[2].maxQuantity).toBe(3);
    expect(view.blockers).toEqual(['out-of-stock', 'collect-unavailable']);
    expect(view.canCheckout).toBe(false);
  });

  it('a failed inventory read raises no stock flag', () => {
    const view = mapCart(ctCart({ lines: [ctLine({ id: 'a', sku: 'S1' })] }), enrichment({ inventory: null }), ctx);
    expect(view.lines[0].notices).toEqual([]);
    expect(view.lines[0].maxQuantity).toBe(99);
  });

  it('ship lines know the stock at the session store', () => {
    const e = enrichment({ sessionStoreKey: STORE_BK.key, inventory: { S1: { online: 9, stores: { 'ch-bk': 0, 'ch-soho': 20 } } } });
    const view = mapCart(ctCart({ lines: [ctLine({ id: 'a', sku: 'S1' })] }), e, ctx);
    expect(view.lines[0].collectAtSessionStore).toEqual({ storeKey: STORE_BK.key, storeName: 'Malva Brooklyn', state: 'out' });
    expect(mapCart(ctCart({ lines: [ctLine({ id: 'a', sku: 'S1' })] }), e, { ...ctx, collection: false }).lines[0].collectAtSessionStore).toBeUndefined();
  });

  it('shipping from shippingInfo or from shipping[] in Multiple mode', () => {
    const lines = [ctLine({ id: 'a', sku: 'S1' })];
    expect(mapCart(ctCart({ lines, shippingCents: 0 }), enrichment(), ctx).shipping).toEqual({ amount: usd(0), isFree: true });
    const multi = ctCart({ lines, mode: 'Multiple', shippingCents: null });
    Object.assign(multi, {
      shipping: [
        { shippingKey: 'a', shippingInfo: { price: { type: 'centPrecision', centAmount: 695, currencyCode: 'USD', fractionDigits: 2 } } },
        { shippingKey: 'b', shippingInfo: { price: { type: 'centPrecision', centAmount: 0, currencyCode: 'USD', fractionDigits: 2 } } },
      ],
    });
    const view = mapCart(multi, enrichment(), ctx);
    expect(view.shipping).toEqual({ amount: usd(695), isFree: false });
    expect(view.shippingMode).toBe('Multiple');
  });

  it('Multiple mode maps shipping from shipping[]', () => {
    const multi = ctCart({ lines: [ctLine({ id: 'a', sku: 'S1' })], mode: 'Multiple', shippingCents: null });
    expect(mapCart(multi, enrichment(), ctx).shipping).toBeNull(); // no shipping[] yet
  });

  it('taxedPrice absent gives null tax and engine total', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'S1', cents: 1000 })], taxCents: null });
    const view = mapCart(cart, enrichment(), ctx);
    expect(view.tax).toBeNull();
    expect(view.total).toEqual(usd(1695)); // totalPrice (net lines + shipping)
  });

  it('tax included in price is reported as included', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'S1', includedInPrice: true })] });
    expect(mapCart(cart, enrichment(), ctx).tax?.included).toBe(true);
  });

  it('applied codes carry state and a reason key when not matching', () => {
    const cart = ctCart({ codes: [{ id: 'c1', code: 'WELCOME10', state: 'MatchesCart', name: 'Welcome' }, { id: 'c2', code: 'COFFEE15', state: 'DoesNotMatchCart' }] });
    const { codes } = mapCart(cart, enrichment(), ctx);
    expect(codes[0]).toEqual({ id: 'c1', code: 'WELCOME10', name: 'Welcome', state: 'MatchesCart' });
    expect(codes[1]).toMatchObject({ code: 'COFFEE15', state: 'DoesNotMatchCart', reasonKey: 'code.reason.DoesNotMatchCart' });
  });

  it('variant summary and free shipping come through', () => {
    const cart = ctCart({ lines: [ctLine({ id: 'a', sku: 'POD-10', cents: 1000 })] });
    const view = mapCart(cart, enrichment({ products: { 'p-POD-10': pod } }), ctx);
    expect(view.lines[0].variantSummary).toBe('Intensity 8 · 10 capsules');
    expect(view.freeShipping).toEqual({ threshold: usd(7500), remaining: usd(6500), reached: false });
  });

  it('minimum order below the minimum blocks checkout', () => {
    const view = mapCart(ctCart({ lines: [ctLine({ id: 'a', sku: 'S1', cents: 1000 })] }), enrichment(), { ...ctx, minOrder: 3000 });
    expect(view.minimumOrder.shortfall).toEqual(usd(2000));
    expect(view.blockers).toEqual(['below-minimum']);
    expect(view.canCheckout).toBe(false);
  });

  it('an empty cart maps to an empty view', () => {
    const view = mapCart(ctCart({ lines: [] }), enrichment(), ctx);
    expect(view).toMatchObject({ lines: [], groups: [], count: 0, canCheckout: false, blockers: ['empty'] });
  });
});
