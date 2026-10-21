import { describe, expect, it } from 'vitest';
import { addButtonState, maxQuantity, minQuantity } from '@/lib/product/add-state';
import { bundleOffered, machineTakesCapsules, podsFitMachine } from '@/lib/product/compatibility';
import { deliveryEstimate } from '@/lib/product/delivery';
import { effectiveUnitPrice, lineTotal, savingPercent } from '@/lib/product/price';
import { firstMissing, optionStates, resolveVariant } from '@/lib/product/resolve-variant';
import type { SelectorDef, VariantPrice, VariantView } from '@/lib/types';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const price = (cents: number, extra: Partial<VariantPrice> = {}): VariantPrice => ({ value: usd(cents), tiers: [], ...extra });
const variant = (sku: string, attrs: VariantView['attrs'], over: Partial<VariantView> = {}): VariantView => ({
  sku, id: 1, attrs, attrLabels: {}, price: price(1000), recurring: [], images: [],
  stock: { online: 10, stores: { 'ch-1': 5 } }, ...over,
});

describe('effectiveUnitPrice and lineTotal', () => {
  it('Price follows the variant: the unit and total follow the chosen quantity', () => {
    const p = price(590);
    expect(effectiveUnitPrice(p, 3)).toEqual(usd(590));
    expect(lineTotal(p, 3)).toEqual(usd(1770));
  });

  it('Quantity crosses a tier: unit price and total change at the boundary', () => {
    const p = price(1000, { tiers: [{ minimumQuantity: 10, value: usd(900) }, { minimumQuantity: 5, value: usd(950) }] });
    expect(effectiveUnitPrice(p, 4)).toEqual(usd(1000));
    expect(effectiveUnitPrice(p, 5)).toEqual(usd(950));
    expect(effectiveUnitPrice(p, 9)).toEqual(usd(950));
    expect(effectiveUnitPrice(p, 10)).toEqual(usd(900));
    expect(lineTotal(p, 4).centAmount).toBe(4000);
    expect(lineTotal(p, 5).centAmount).toBe(4750);
    expect(lineTotal(p, 10).centAmount).toBe(9000);
  });

  it('promotion disables volume tier', () => {
    const p = price(1000, { discounted: usd(800), tiers: [{ minimumQuantity: 2, value: usd(500) }] });
    expect(effectiveUnitPrice(p, 5)).toEqual(usd(800));
    expect(lineTotal(p, 5).centAmount).toBe(4000);
  });

  it('saving percent is whole and only positive', () => {
    expect(savingPercent(usd(1000), usd(900))).toBe(10);
    expect(savingPercent(usd(1000), usd(1000))).toBeUndefined();
    expect(savingPercent(usd(1000), usd(1200))).toBeUndefined();
    expect(savingPercent(usd(0), usd(0))).toBeUndefined();
  });
});

describe('resolveVariant', () => {
  const vs = [
    variant('250-WB', { sizeGrams: 250, grind: 'whole-bean' }),
    variant('250-FIL', { sizeGrams: 250, grind: 'filter' }),
    variant('1K-WB', { sizeGrams: 1000, grind: 'whole-bean' }),
  ];
  it('resolves the variant whose attributes equal the selection', () => {
    expect(resolveVariant(vs, { sizeGrams: '250', grind: 'filter' }, ['sizeGrams', 'grind'])?.sku).toBe('250-FIL');
    expect(resolveVariant(vs, { sizeGrams: '1000', grind: 'whole-bean' }, ['sizeGrams', 'grind'])?.sku).toBe('1K-WB');
  });
  it('is null while a required attribute is unselected or nothing matches', () => {
    expect(resolveVariant(vs, { sizeGrams: '250' }, ['sizeGrams', 'grind'])).toBeNull();
    expect(resolveVariant(vs, { sizeGrams: '1000', grind: 'filter' }, ['sizeGrams', 'grind'])).toBeNull();
  });
  it('Required choice missing reads Select a grind: the first unselected required selector', () => {
    const selectors: SelectorDef[] = [
      { attr: 'sizeGrams', renderer: 'pill', required: true, options: [] },
      { attr: 'grind', renderer: 'pill', required: true, options: [] },
    ];
    expect(firstMissing(selectors, { sizeGrams: '250' })?.attr).toBe('grind');
    expect(firstMissing(selectors, { sizeGrams: '250', grind: 'filter' })).toBeUndefined();
    const state = addButtonState({ missingChoice: 'Grind', variant: null, fulfilment: 'delivery', quantity: 1 });
    expect(state).toEqual({ key: 'select', disabled: true, showTotal: false });
  });
});

describe('optionStates', () => {
  const grind: SelectorDef = { attr: 'grind', renderer: 'pill', required: true, options: [{ value: 'whole-bean', label: 'Whole bean' }, { value: 'filter', label: 'Filter' }] };
  it('Variant out of stock at store disables the option with the reason', () => {
    const vs = [
      variant('A', { grind: 'whole-bean' }, { stock: { online: 5, stores: { 'ch-1': 0 } } }),
      variant('B', { grind: 'filter' }, { stock: { online: 5, stores: { 'ch-1': 3 } } }),
    ];
    const collect = optionStates(vs, {}, grind, { fulfilment: 'collect', storeChannelId: 'ch-1' });
    expect(collect).toEqual([{ value: 'whole-bean', disabled: true, reason: 'notAvailableForCollection' }, { value: 'filter', disabled: false }]);
    expect(optionStates(vs, {}, grind, { fulfilment: 'delivery' }).every((o) => !o.disabled)).toBe(true);
    // no store chosen: nothing is disabled for collection
    expect(optionStates(vs, {}, grind, { fulfilment: 'collect' }).every((o) => !o.disabled)).toBe(true);
  });
  it('online out of stock never disables an option', () => {
    const vs = [variant('A', { grind: 'whole-bean' }, { stock: { online: 0, stores: {} } }), variant('B', { grind: 'filter' })];
    expect(optionStates(vs, {}, grind, { fulfilment: 'delivery' }).every((o) => !o.disabled)).toBe(true);
  });
  it('disabled when no variant has the combination or no price', () => {
    const vs = [variant('A', { sizeGrams: 250, grind: 'whole-bean' }), variant('B', { sizeGrams: 1000, grind: 'filter' }, { price: null })];
    const states = optionStates(vs, { sizeGrams: '250' }, grind, { fulfilment: 'delivery' });
    expect(states).toEqual([{ value: 'whole-bean', disabled: false }, { value: 'filter', disabled: true, reason: 'noVariant' }]);
    expect(optionStates(vs, { sizeGrams: '1000' }, grind, { fulfilment: 'delivery' })[1]).toEqual({ value: 'filter', disabled: true, reason: 'noPrice' });
  });
  it('Incompatible combination bundle is disabled not offered', () => {
    const bundle: SelectorDef = { attr: 'bundle', renderer: 'pill', required: true, options: [{ value: 'machine-only', label: 'a' }, { value: 'starter-capsules', label: 'b' }] };
    const vs = [variant('M', { bundle: 'machine-only' }), variant('S', { bundle: 'starter-capsules' })];
    expect(optionStates(vs, {}, bundle, { fulfilment: 'delivery', systemKey: 'espresso' })[1]).toEqual({ value: 'starter-capsules', disabled: true, reason: 'bundleNotForMachine' });
    expect(optionStates(vs, {}, bundle, { fulfilment: 'delivery', systemKey: 'original' })[1]).toEqual({ value: 'starter-capsules', disabled: false });
  });
});

describe('compatibility', () => {
  it('pods fit only the same system', () => {
    expect(podsFitMachine('original', 'original')).toBe(true);
    expect(podsFitMachine('vertuo', 'vertuo')).toBe(true);
    expect(podsFitMachine('original', 'vertuo')).toBe(false);
    expect(podsFitMachine('vertuo', 'original')).toBe(false);
    for (const m of ['bean-to-cup', 'espresso', 'filter']) {
      expect(podsFitMachine(m, 'original')).toBe(false);
      expect(machineTakesCapsules(m)).toBe(false);
    }
    expect(podsFitMachine(undefined, 'original')).toBe(false);
  });
  it('bundleOffered only restricts the starter capsules bundle', () => {
    expect(bundleOffered('filter', 'starter-capsules')).toBe(false);
    expect(bundleOffered('filter', 'machine-only')).toBe(true);
    expect(bundleOffered('vertuo', 'starter-capsules')).toBe(true);
    expect(bundleOffered(undefined, 'starter-capsules')).toBe(false);
  });
});

describe('addButtonState', () => {
  const v = variant('A', {});
  const base = { variant: v, fulfilment: 'delivery' as const, quantity: 1 };
  it('No price resolves is not added and has no fallback', () => {
    expect(addButtonState({ ...base, variant: variant('A', {}, { price: null }) })).toEqual({ key: 'priceOnRequest', disabled: true, showTotal: false });
    expect(addButtonState({ ...base, variant: variant('A', {}, { price: null }), fulfilment: 'collect', storeChannelId: 'ch-1' }).disabled).toBe(true);
  });
  it('Out of stock for collection disables with the label and Ship re-enables', () => {
    const empty = variant('A', {}, { stock: { online: 8, stores: { 'ch-1': 0 } } });
    expect(addButtonState({ variant: empty, fulfilment: 'collect', storeChannelId: 'ch-1', quantity: 1 })).toEqual({ key: 'unavailableCollect', disabled: true, showTotal: false });
    expect(addButtonState({ variant: empty, fulfilment: 'delivery', quantity: 1 })).toEqual({ key: 'addToBag', disabled: false, showTotal: true });
  });
  it('collect with no store opens the picker and stays enabled', () => {
    expect(addButtonState({ ...base, fulfilment: 'collect' })).toEqual({ key: 'chooseStore', disabled: false, showTotal: false });
  });
  it('delivery and subscribe with no online stock read out of stock', () => {
    const none = variant('A', {}, { stock: { online: 0, stores: { 'ch-1': 4 } } });
    expect(addButtonState({ variant: none, fulfilment: 'delivery', quantity: 1 }).key).toBe('outOfStock');
    expect(addButtonState({ variant: none, fulfilment: 'subscribe', quantity: 1 }).key).toBe('outOfStock');
  });
  it('add label includes line total only when enabled', () => {
    expect(addButtonState({ ...base, fulfilment: 'delivery' }).showTotal).toBe(true);
    expect(addButtonState({ ...base, fulfilment: 'subscribe' })).toEqual({ key: 'subscribe', disabled: false, showTotal: true });
    expect(addButtonState({ ...base, fulfilment: 'collect', storeChannelId: 'ch-1' })).toEqual({ key: 'reserve', disabled: false, showTotal: true });
    expect(addButtonState({ ...base, quantity: 11 }).showTotal).toBe(false);
    expect(addButtonState({ ...base, missingChoice: 'Grind' }).showTotal).toBe(false);
  });
  it('a failed stock read never claims stock', () => {
    expect(addButtonState({ ...base, inventoryFailed: true })).toEqual({ key: 'stockUnknown', disabled: true, showTotal: false });
  });
});

describe('quantity limits', () => {
  it('clamps to stock of the active fulfilment, max and min cart quantity', () => {
    const v = variant('A', {}, { stock: { online: 20, stores: { 'ch-1': 3 }, maxQty: 6, minQty: 2 } });
    expect(maxQuantity(v, 'delivery', undefined, 99)).toBe(6);
    expect(maxQuantity(v, 'collect', 'ch-1', 99)).toBe(3);
    expect(maxQuantity(variant('B', {}), 'delivery', undefined, 99)).toBe(10);
    expect(maxQuantity(null, 'delivery', undefined, 99)).toBe(99);
    expect(minQuantity(v)).toBe(2);
    expect(minQuantity(null)).toBe(1);
  });
});

describe('deliveryEstimate', () => {
  const rule = { cutoffHour: 14, timeZone: 'America/New_York', minDays: 2, maxDays: 4 };
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  it('delivery estimate skips weekends and respects the cut-off', () => {
    // Wed 21 Oct 2026, 10:00 New York (EDT): before the cut-off.
    const before = deliveryEstimate(new Date('2026-10-21T14:00:00Z'), rule);
    expect(before.beforeCutoff).toBe(true);
    expect(before.hoursLeft).toBe(4);
    expect(ymd(before.earliest)).toBe('2026-10-23'); // Fri
    expect(ymd(before.latest)).toBe('2026-10-27'); // Tue, the weekend skipped
    // Wed 15:00: after the cut-off, processing starts Thursday.
    const after = deliveryEstimate(new Date('2026-10-21T19:00:00Z'), rule);
    expect(after.beforeCutoff).toBe(false);
    expect(after.hoursLeft).toBe(0);
    expect(ymd(after.earliest)).toBe('2026-10-26');
    expect(ymd(after.latest)).toBe('2026-10-28');
  });
  it('a Saturday order starts on Monday', () => {
    const sat = deliveryEstimate(new Date('2026-10-24T14:00:00Z'), rule);
    expect(sat.beforeCutoff).toBe(false);
    expect(ymd(sat.earliest)).toBe('2026-10-28'); // Mon + 2
    expect(ymd(sat.latest)).toBe('2026-10-30');
  });
  it('uses the market time zone for the cut-off', () => {
    // 18:30 UTC is 14:30 in New York (after) but 11:30 in Los Angeles (before).
    expect(deliveryEstimate(new Date('2026-10-21T18:30:00Z'), rule).beforeCutoff).toBe(false);
    expect(deliveryEstimate(new Date('2026-10-21T18:30:00Z'), { ...rule, timeZone: 'America/Los_Angeles' }).beforeCutoff).toBe(true);
  });
});
