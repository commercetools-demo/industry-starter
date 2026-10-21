import { describe, expect, it } from 'vitest';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { mapProductSummary, type SummaryContext } from '@/lib/mappers/product-summary';
import { pickBadge } from '@/lib/product/badge';

const ctx: SummaryContext = { locale: 'en-US', country: 'US', currency: 'USD', categoryName: () => 'Pods' };
const money = (c: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount: c, fractionDigits: 2 });
const price = (c: number, discounted?: number) => ({
  id: `p${c}`, value: money(c), country: 'US',
  ...(discounted ? { discounted: { value: money(discounted), discount: { typeId: 'product-discount', id: 'd', obj: { name: { 'en-US': 'Spring sale' } } } } } : {}),
});
const enumAttr = (name: string, k: string, l = k) => ({ name, value: { key: k, label: l } });
const variant = (id: number, sku: string, cents: number | null, attributes: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  id, sku, images: [], attributes, ...(cents === null ? {} : { price: price(cents) }), ...extra,
});
function product(over: Record<string, unknown>): ProductProjection {
  return {
    id: 'p1', version: 1, name: { 'en-US': 'Ember Ristretto' }, slug: { 'en-US': 'ember-ristretto' },
    categories: [{ typeId: 'category', id: 'c1' }], attributes: [], variants: [],
    masterVariant: variant(1, 'S-10', 490), ...over,
  } as unknown as ProductProjection;
}

describe('mapProductSummary', () => {
  it('Card rating shows 4.6 and 12 reviews', () => {
    const s = mapProductSummary(product({ reviewRatingStatistics: { averageRating: 4.58333, count: 12, highestRating: 5, lowestRating: 3, ratingsDistribution: {} } }), ctx);
    expect(s.rating).toEqual({ average: 4.6, count: 12 });
  });
  it('No reviews hides the rating', () => {
    expect(mapProductSummary(product({}), ctx).rating).toBeNull();
    expect(mapProductSummary(product({ reviewRatingStatistics: { averageRating: 0, count: 0 } }), ctx).rating).toBeNull();
  });
  it('From price when variants differ', () => {
    const s = mapProductSummary(product({ variants: [variant(2, 'S-50', 2000)] }), ctx);
    expect(s.price).toMatchObject({ from: { centAmount: 490 }, fromIsRange: true });
    expect(mapProductSummary(product({ variants: [variant(2, 'S-50', 490)] }), ctx).price?.fromIsRange).toBe(false);
  });
  it('Pods unit price 0.49 per capsule', () => {
    const s = mapProductSummary(product({ masterVariant: variant(1, 'S-10', 490, [{ name: 'capsulesPerPack', value: 10 }]) }), ctx);
    expect(s.unit).toEqual({ money: { centAmount: 49, currencyCode: 'USD' }, perKey: 'capsule' });
  });
  it('coffee unit price per 100 g', () => {
    const s = mapProductSummary(product({ masterVariant: variant(1, 'C-250', 1695, [{ name: 'sizeGrams', value: 250 }]) }), ctx);
    expect(s.unit).toEqual({ money: { centAmount: 678, currencyCode: 'USD' }, perKey: '100g' });
  });
  it('swatches only for colour variants', () => {
    const colours = product({
      masterVariant: variant(1, 'M-BLK', 12900, [enumAttr('colour', 'black', 'Black')]),
      variants: [variant(2, 'M-RED', 12900, [enumAttr('colour', 'red', 'Red')])],
    });
    const s = mapProductSummary(colours, ctx);
    expect(s.swatches).toEqual([{ key: 'black', name: 'Black' }, { key: 'red', name: 'Red' }]);
    expect(s.requiredChoice).toBe('colour');
    expect(mapProductSummary(product({}), ctx).swatches).toBeUndefined();
  });
  it('pods show an intensity label', () => {
    const s = mapProductSummary(product({ masterVariant: variant(1, 'S-10', 490, [{ name: 'capsulesPerPack', value: 10 }, { name: 'intensity', value: 12 }]) }), ctx);
    expect(s.label).toEqual({ kind: 'intensity', value: '12' });
  });
  it('coffee shows the roast label', () => {
    const s = mapProductSummary(product({ masterVariant: variant(1, 'C', 1500, [enumAttr('roast', 'dark', 'Dark')]) }), ctx);
    expect(s.label).toEqual({ kind: 'roast', value: 'Dark' });
  });
  it('Multiple qualifying flags shows one badge by fixed precedence', () => {
    expect(pickBadge({ badge: 'new', subscribable: true })).toBe('new');
    expect(pickBadge({ badge: 'bestseller', subscribable: true })).toBe('bestseller');
    expect(pickBadge({ badge: 'limited-edition' })).toBe('limited-edition');
    expect(pickBadge({ badge: 'none', subscribable: true })).toBe('subscribe');
    expect(pickBadge({ badge: 'none' })).toBeNull();
    const s = mapProductSummary(product({ attributes: [enumAttr('badge', 'new'), { name: 'subscribable', value: true }] }), ctx);
    expect(s.badge).toBe('new');
  });
  it('discounted price carries old price and name', () => {
    const s = mapProductSummary(product({ masterVariant: { ...variant(1, 'S', 1000), price: price(1000, 800) } }), ctx);
    expect(s.price).toMatchObject({ from: { centAmount: 800 }, old: { centAmount: 1000 }, discountName: 'Spring sale' });
  });
  it('no price maps to null and zero maps to null', () => {
    expect(mapProductSummary(product({ masterVariant: variant(1, 'S', null) }), ctx).price).toBeNull();
    expect(mapProductSummary(product({ masterVariant: variant(1, 'S', 0) }), ctx).price).toBeNull();
  });
  it('requiredChoice for coffee grind and machine colour', () => {
    const coffee = product({
      masterVariant: variant(1, 'C-WB', 1500, [enumAttr('grind', 'whole-bean')]),
      variants: [variant(2, 'C-F', 1500, [enumAttr('grind', 'filter')])],
    });
    expect(mapProductSummary(coffee, ctx).requiredChoice).toBe('grind');
    expect(mapProductSummary(product({}), ctx).requiredChoice).toBeNull();
  });
  it('localized name and category', () => {
    const s = mapProductSummary(product({ name: { 'en-CA': 'Ember', 'en-US': 'Ember US' } }), { ...ctx, locale: 'en-CA', categoryName: (ids) => `cat:${ids[0]}` });
    expect(s.name).toBe('Ember');
    expect(s.categoryName).toBe('cat:c1');
  });
  it('matchedSku set from matching variants', () => {
    expect(mapProductSummary(product({}), { ...ctx, matchedSku: 'S-10' }).matchedSku).toBe('S-10');
  });
  it('default variant is the cheapest priced one', () => {
    const s = mapProductSummary(product({ masterVariant: variant(1, 'BIG', 2000), variants: [variant(2, 'SMALL', 490)] }), ctx);
    expect(s.sku).toBe('SMALL');
  });
  it('availability follows the chosen store channel', () => {
    const av = (q: number) => ({ channels: { 'chan-1': { isOnStock: q > 0, availableQuantity: q } } });
    const withStock = (q: number) => product({ masterVariant: variant(1, 'S', 490, [], { availability: av(q) }) });
    expect(mapProductSummary(withStock(40), { ...ctx, storeChannelId: 'chan-1' }).availability).toEqual({ state: 'in' });
    expect(mapProductSummary(withStock(3), { ...ctx, storeChannelId: 'chan-1' }).availability).toEqual({ state: 'low' });
    expect(mapProductSummary(withStock(0), { ...ctx, storeChannelId: 'chan-1' }).availability).toEqual({ state: 'out' });
    expect(mapProductSummary(withStock(40), ctx).availability).toBeNull();
  });
});
