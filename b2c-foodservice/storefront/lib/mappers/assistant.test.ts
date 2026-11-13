import { describe, expect, it } from 'vitest';
import type { ProductSummary } from '@/lib/types';
import { orderView } from '@/test/checkout';
import { usd, viewCart, viewLine } from '@/test/cart';
import { podPage } from '@/test/pdp';
import { cartFromView, detailsFromPage, orderFromView, productFromSummary, totalsFromView } from './assistant';

const summary = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 'p-1', slug: 'ember', sku: 'MCF-POD-EMBER-10', name: 'Ember Ristretto', categoryName: 'Pods', imageAlt: 'Ember',
  badge: 'bestseller', price: { from: usd(4297), fromIsRange: false }, requiredChoice: null, rating: { average: 4.5, count: 12 },
  availability: null, ...over,
});

const stockOf = (skus: Record<string, number>) => skus;

describe('assistant mappers', () => {
  it('Major units: 4297 minor is 42.97', () => {
    const product = productFromSummary(summary(), 'USD');
    expect(product?.price).toBe(42.97);
    expect(product?.currency).toBe('USD');
  });

  it('A line unit price times quantity reproduces the line total', () => {
    const cart = cartFromView(viewCart([viewLine({ id: 'a', quantity: 3, unitPrice: usd(1000) })]));
    const [item] = cart.items;
    expect(item?.productId).toBe('SKU-a');
    expect(Math.round((item?.price ?? 0) * (item?.quantity ?? 0) * 100)).toBe(3000);
  });

  it('A family and its variants get fam: and sku ids', () => {
    const details = detailsFromPage(podPage(), stockOf({ 'POD-10': 5, 'POD-50': 0, 'POD-100': 2 }));
    expect(details?.productId).toBe('fam:POD-10');
    expect(details?.variants.map((v) => v.productId)).toEqual(['POD-10', 'POD-50', 'POD-100']);
    expect(details?.variants.every((v) => v.variantOf === 'fam:POD-10')).toBe(true);
    expect(details?.options).toEqual({ capsulesPerPack: ['10', '50', '100'] });
    expect(details?.variants[1]?.inStock).toBe(false);
    expect(details?.variants[0]?.optionValues).toEqual({ capsulesPerPack: '10' });
  });

  it('A family from search carries fam: with the default sku and its colour options', () => {
    const product = productFromSummary(
      summary({ requiredChoice: 'colour', swatches: [{ key: 'red', name: 'Red' }, { key: 'blue', name: 'Blue' }] }),
      'USD',
    );
    expect(product?.productId).toBe('fam:MCF-POD-EMBER-10');
    expect(product?.options).toEqual({ colour: ['Red', 'Blue'] });
  });

  it('Totals carry no shipping or tax', () => {
    const totals = totalsFromView(viewCart([viewLine({ id: 'a', quantity: 1, unitPrice: usd(1000) })]));
    expect(Object.keys(totals ?? {}).sort()).toEqual(['currency', 'totalMinor']);
    expect(totalsFromView(viewCart([]))).toBeNull();
  });

  it('Unmapped order state leaves status absent', () => {
    const mapped = orderFromView(orderView({ status: 'shipped' }), '/malva-coffee/en-US');
    expect(mapped.status).toBe('shipped');
    const unmapped = orderFromView(orderView({ status: 'ready' }), '/malva-coffee/en-US');
    expect('status' in unmapped).toBe(false);
  });

  it('Order link is same-origin only', () => {
    const local = orderFromView(orderView({ orderNumber: 'MC-1' }), '/malva-coffee/en-US');
    expect(local.viewUrl).toBe('/malva-coffee/en-US/account/orders/MC-1');
    const foreign = orderFromView(orderView({ orderNumber: 'MC-1' }), 'https://evil.example');
    expect('viewUrl' in foreign).toBe(false);
  });

  it('Absent figures are omitted, never zero', () => {
    const product = productFromSummary(summary({ rating: null, badge: null }), 'USD');
    expect('rating' in (product ?? {})).toBe(false);
    expect('reviewCount' in (product ?? {})).toBe(false);
    expect(productFromSummary(summary({ price: null }), 'USD')).toBeNull();
    const order = orderFromView(orderView({ deliveries: [] }), '/malva-coffee/en-US');
    expect('trackingUrl' in order).toBe(false);
  });
});
