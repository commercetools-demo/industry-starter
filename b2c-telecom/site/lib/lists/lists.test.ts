import type { Money, Offer, OfferKind, OfferVariant } from '@/lib/types';
import { priceDelta } from './delta';
import { lineOrder, sortForBundle } from './order';
import { lineKey, resolveLines } from './resolve';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const variant = (id: number, over: Partial<OfferVariant> = {}): OfferVariant => ({ id, sku: `SKU-${id}`, isMaster: id === 1, term: '24-months', termMonths: 24, images: [], attributes: {}, ...over });
const offer = (key: string, variants: OfferVariant[], over: Partial<Offer> = {}): Offer => ({ id: `p-${key}`, key, kind: 'base-package', name: `Name ${key}`, variants, ...over }) as unknown as Offer;
const NOW = new Date('2026-10-07T12:00:00Z');

describe('priceDelta', () => {
  it('is same, up or down with the difference in cents', () => {
    expect(priceDelta(usd(5999), usd(5999))).toEqual({ status: 'same', deltaCents: 0 });
    expect(priceDelta(usd(5499), usd(5999))).toEqual({ status: 'up', deltaCents: 500 });
    expect(priceDelta(usd(5999), usd(5499))).toEqual({ status: 'down', deltaCents: -500 });
  });
  it('is unknown without a price or when the currency changed', () => {
    expect(priceDelta(null, usd(1))).toEqual({ status: 'unknown', deltaCents: 0 });
    expect(priceDelta(usd(1), null).status).toBe('unknown');
    expect(priceDelta(usd(1), { centAmount: 1, currencyCode: 'EUR' }).status).toBe('unknown');
  });
});

describe('lineOrder', () => {
  it('puts plans before handsets before add-ons and equipment, keeping the list order inside a rank', () => {
    expect(lineOrder('base-package')).toBe(0);
    expect(lineOrder('bundle')).toBe(0);
    expect(lineOrder('device')).toBe(1);
    expect(lineOrder('addon')).toBe(2);
    expect(lineOrder('equipment')).toBe(2);
    const kinds: Array<[string, OfferKind]> = [['spotify', 'addon'], ['nova', 'device'], ['cable', 'base-package'], ['router', 'equipment'], ['phone', 'base-package']];
    expect(sortForBundle(kinds, (entry) => entry[1]).map((entry) => entry[0])).toEqual(['cable', 'phone', 'nova', 'spotify', 'router']);
  });
});

describe('resolveLines', () => {
  const lines = [{ offerKey: 'cable', variantId: 1 }];
  it('prefers the recurring price over the one-time price and gives the term', () => {
    const map = resolveLines(lines, [offer('cable', [variant(1, { recurringPrice: usd(5999), oneTimePrice: usd(9900) })])], NOW);
    expect(map.get(lineKey('cable', 1))).toMatchObject({ available: true, name: 'Name cable', term: '24-months', current: usd(5999) });
  });
  it('uses the one-time price when there is no recurring price, then the lowest financed price', () => {
    expect(resolveLines(lines, [offer('cable', [variant(1, { term: null, termMonths: null, oneTimePrice: usd(9900) })])], NOW).get('cable:1')?.current).toEqual(usd(9900));
    expect(resolveLines(lines, [offer('cable', [variant(1, { term: null, termMonths: null, financedPrices: [usd(3000), usd(4000)] })])], NOW).get('cable:1')?.current).toEqual(usd(3000));
  });
  it('describes a variant without a term by its colour and memory', () => {
    const map = resolveLines(lines, [offer('cable', [variant(1, { term: null, termMonths: null, attributes: { color: 'black', 'memory-gb': 256 } })], { kind: 'device' })], NOW);
    expect(map.get('cable:1')).toMatchObject({ term: null, variantLabel: 'Black · 256 GB' });
  });
  it('marks a missing offer unavailable (unpublished or hidden)', () => {
    expect(resolveLines(lines, [], NOW).get('cable:1')).toMatchObject({ available: false, reason: 'NOT_PUBLISHED', current: null });
  });
  it('marks an offer that has not started yet unavailable', () => {
    const map = resolveLines(lines, [offer('cable', [variant(1)], { startTime: '2026-11-01T00:00:00Z' })], NOW);
    expect(map.get('cable:1')).toMatchObject({ available: false, reason: 'NOT_STARTED', name: 'Name cable' });
    expect(resolveLines(lines, [offer('cable', [variant(1)], { startTime: '2026-10-01T00:00:00Z' })], NOW).get('cable:1')?.available).toBe(true);
  });
  it('marks a variant that is gone unavailable', () => {
    expect(resolveLines([{ offerKey: 'cable', variantId: 3 }], [offer('cable', [variant(1)])], NOW).get('cable:3')).toMatchObject({ available: false, reason: 'VARIANT_GONE' });
  });
});
