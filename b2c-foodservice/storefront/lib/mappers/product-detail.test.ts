import { describe, expect, it } from 'vitest';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { mapProductDetail, type DetailContext } from '@/lib/mappers/product-detail';
import type { Category } from '@/lib/types';

const money = (centAmount: number, currencyCode = 'USD') => ({ type: 'centPrecision', currencyCode, centAmount, fractionDigits: 2 });
const enumVal = (key: string, label = key) => ({ key, label });
const price = (cents: number, country = 'US', currency = 'USD', extra: Record<string, unknown> = {}) => ({
  id: `p-${country}-${cents}`, value: money(cents, currency), country, ...extra,
});

const TREE: Category[] = [
  {
    id: 'c-pods', key: 'mcf-cat-pods', name: 'Pods', slug: 'pods', children: [
      { id: 'c-orig', key: 'mcf-cat-pods-original', name: 'Original', slug: 'pods-original', parentId: 'c-pods', children: [] },
    ],
  },
];

const ctx = (over: Partial<DetailContext> = {}): DetailContext => ({
  locale: 'en-US', country: 'US', currency: 'USD', labels: {}, tree: TREE, inventory: {}, ...over,
});

const pods = (variantOver: Record<string, unknown> = {}, productOver: Record<string, unknown> = {}) =>
  ({
    id: 'p1', version: 1, key: 'mcf-p-ember',
    productType: { typeId: 'product-type', id: 'pt', obj: { key: 'mcf-pods' } },
    name: { 'en-US': 'Ember Ristretto' }, slug: { 'en-US': 'ember-ristretto' },
    description: { 'en-US': 'A dark roast pod. Compatible with Original machines.' },
    categories: [{ typeId: 'category', id: 'c-orig' }],
    reviewRatingStatistics: { averageRating: 4.5, count: 4, ratingsDistribution: { '5': 2, '4': 2 } },
    attributes: [
      { name: 'system', value: enumVal('original', 'Original') },
      { name: 'intensity', value: 12 },
      { name: 'roast', value: enumVal('dark', 'Dark') },
      { name: 'flavourNotes', value: [{ 'en-US': 'dark chocolate' }, { 'en-US': 'oak' }] },
      { name: 'origin', value: 'Brazil' },
      { name: 'badge', value: enumVal('bestseller') },
      { name: 'subscribable', value: true },
    ],
    masterVariant: {
      id: 1, sku: 'POD-10', images: [{ url: 'https://img.example.com/a.jpg?w=9', dimensions: { w: 1, h: 1 } }],
      attributes: [{ name: 'capsulesPerPack', value: 10 }], price: price(590),
      recurrencePrices: [
        { ...price(531), recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-month' } },
        { ...price(700, 'CA', 'CAD'), recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-month' } },
        { ...price(500), recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-gone' } },
      ],
      ...variantOver,
    },
    variants: [
      { id: 2, sku: 'POD-50', images: [], attributes: [{ name: 'capsulesPerPack', value: 50 }], price: price(2595) },
      { id: 3, sku: 'POD-100', images: [], attributes: [{ name: 'capsulesPerPack', value: 100 }] },
    ],
    ...productOver,
  }) as unknown as ProductProjection;

describe('mapProductDetail', () => {
  it('recurring prices filtered by currency and country and by existing policies', () => {
    const d = mapProductDetail(pods(), ctx({ policyIds: new Set(['rp-month']) }));
    expect(d.variants[0]?.recurring).toEqual([{ policyId: 'rp-month', value: { centAmount: 531, currencyCode: 'USD' } }]);
    const noCheck = mapProductDetail(pods(), ctx());
    expect(noCheck.variants[0]?.recurring.map((r) => r.policyId)).toEqual(['rp-month', 'rp-gone']);
  });

  it('distribution from ratings statistics', () => {
    const d = mapProductDetail(pods(), ctx());
    expect(d.rating).toEqual({ average: 4.5, count: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 } });
    expect(mapProductDetail(pods({}, { reviewRatingStatistics: { averageRating: 0, count: 0 } }), ctx()).rating).toBeNull();
    expect(mapProductDetail(pods({}, { reviewRatingStatistics: undefined }), ctx()).rating).toBeNull();
  });

  it('price null for zero or missing', () => {
    const d = mapProductDetail(pods({ price: price(0) }), ctx());
    expect(d.variants[0]?.price).toBeNull();
    expect(d.variants[2]?.price).toBeNull(); // no price selected at all
    expect(d.variants[1]?.price).toEqual({ value: { centAmount: 2595, currencyCode: 'USD' }, tiers: [] });
  });

  it('selectors only for attributes with more than one value', () => {
    const d = mapProductDetail(pods(), ctx());
    expect(d.selectors.map((s) => s.attr)).toEqual(['capsulesPerPack']);
    expect(d.selectors[0]?.options.map((o) => o.value)).toEqual(['10', '50', '100']);
    const single = mapProductDetail(pods({}, { variants: [] }), ctx());
    expect(single.selectors).toEqual([]);
  });

  it('info attributes are not selectors', () => {
    const d = mapProductDetail(pods(), ctx());
    for (const name of ['system', 'intensity', 'roast', 'origin', 'flavourNotes', 'badge', 'subscribable']) {
      expect(d.selectors.map((s) => s.attr)).not.toContain(name);
      expect(Object.keys(d.variants[0]?.attrs ?? {})).not.toContain(name === 'system' || name === 'intensity' ? '' : 'badge');
    }
    expect(d.variants[0]?.attrs).toEqual({ capsulesPerPack: 10 });
    expect(d.facts).toMatchObject({ intensity: 12, roast: 'Dark', origin: 'Brazil', notes: ['dark chocolate', 'oak'] });
    expect(d.systemKey).toBe('original');
    expect(d.shape).toBe('pods');
    expect(d.badge).toBe('bestseller');
  });

  it('variant without images uses the product images; unit price per capsule', () => {
    const d = mapProductDetail(pods(), ctx());
    expect(d.variants[1]?.images.map((i) => i.url)).toEqual(['https://img.example.com/a.jpg']);
    expect(d.variants[1]?.unit).toEqual({ money: { centAmount: 52, currencyCode: 'USD' }, perKey: 'capsule' });
  });

  it('stock comes from the inventory read, never from variant availability', () => {
    const d = mapProductDetail(
      pods({ availability: { isOnStock: true, availableQuantity: 999 } }),
      ctx({ inventory: { 'POD-10': { online: 7, stores: { 'ch-1': 0 }, restockableInDays: 3 } } }),
    );
    expect(d.variants[0]?.stock).toEqual({ online: 7, stores: { 'ch-1': 0 }, restockableInDays: 3 });
    expect(d.variants[1]?.stock).toEqual({ online: 0, stores: {} });
  });

  it('breadcrumb follows the deepest category and the tagline is the first sentence', () => {
    const d = mapProductDetail(pods(), ctx());
    expect(d.breadcrumb).toEqual([{ id: 'c-pods', name: 'Pods', slug: 'pods' }, { id: 'c-orig', name: 'Original', slug: 'pods-original' }]);
    expect(d.categoryName).toBe('Pods');
    expect(d.tagline).toBe('A dark roast pod.');
  });

  it('default sku is the cheapest priced variant', () => {
    expect(mapProductDetail(pods(), ctx()).defaultSku).toBe('POD-10');
  });

  it('discount and tiers are carried; a discounted price wins for the unit price', () => {
    const d = mapProductDetail(
      pods({
        price: {
          ...price(1000),
          discounted: { value: money(800), discount: { typeId: 'product-discount', id: 'd', obj: { name: { 'en-US': 'Spring' } } } },
          tiers: [{ minimumQuantity: 5, value: money(700) }],
        },
      }),
      ctx(),
    );
    expect(d.variants[0]?.price).toEqual({
      value: { centAmount: 1000, currencyCode: 'USD' }, discounted: { centAmount: 800, currencyCode: 'USD' }, discountName: 'Spring',
      tiers: [{ minimumQuantity: 5, value: { centAmount: 700, currencyCode: 'USD' } }],
    });
    expect(d.variants[0]?.unit?.money.centAmount).toBe(80);
  });

  it('machine and coffee selectors, specs and shape', () => {
    const machine = {
      ...pods(),
      productType: { typeId: 'product-type', id: 'pt', obj: { key: 'mcf-machine' } },
      attributes: [
        { name: 'system', value: enumVal('vertuo', 'Vertuo') },
        { name: 'pressureBar', value: 19 }, { name: 'features', value: ['Fast', 'Quiet'] },
        { name: 'subscribable', value: false },
      ],
      masterVariant: { id: 1, sku: 'M-B-M', attributes: [{ name: 'colour', value: enumVal('black', 'Black') }, { name: 'bundle', value: enumVal('machine-only', 'Machine only') }], price: price(12900), images: [] },
      variants: [
        { id: 2, sku: 'M-B-S', attributes: [{ name: 'colour', value: enumVal('black', 'Black') }, { name: 'bundle', value: enumVal('starter-capsules', 'Starter') }], price: price(15390), images: [] },
        { id: 3, sku: 'M-R-M', attributes: [{ name: 'colour', value: enumVal('red', 'Red') }, { name: 'bundle', value: enumVal('machine-only', 'Machine only') }], price: price(12900), images: [] },
      ],
    } as unknown as ProductProjection;
    const d = mapProductDetail(machine, ctx());
    expect(d.shape).toBe('machine');
    expect(d.selectors.map((s) => [s.attr, s.renderer])).toEqual([['colour', 'colour'], ['bundle', 'pill']]);
    expect(d.selectors[0]?.options).toEqual([{ value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }]);
    expect(d.facts.specs).toEqual([{ key: 'system', value: 'Vertuo' }, { key: 'pressureBar', value: '19' }, { key: 'features', value: 'Fast, Quiet' }]);
    expect(d.systemKey).toBe('vertuo');
    expect(d.subscribable).toBe(false);
  });
});
