import { describe, expect, it } from 'vitest';
import { rejectionKey, stateReasonKey, toCodeState } from '@/lib/cart/discount-reasons';
import { blockers, freeShipping, minimumOrder, taxLabel, variantSummary, type VariantTranslator } from '@/lib/cart/summary';
import type { CartLine, Money } from '@/lib/types';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const cad = (centAmount: number): Money => ({ centAmount, currencyCode: 'CAD' });
const t: VariantTranslator = (key, v) =>
  key === 'variant.intensity' ? `Intensity ${v.n}` : key === 'variant.capsules' ? `${v.count} capsules` : `${v.n} g`;
const ln = (fulfilment: CartLine['fulfilment'], cents: number) => ({ fulfilment, total: usd(cents) });

describe('variantSummary', () => {
  it('variant summary for pods coffee machine accessory', () => {
    expect(variantSummary('pods', { intensity: 8, capsulesPerPack: 10 }, {}, t)).toBe('Intensity 8 · 10 capsules');
    expect(variantSummary('coffee', { sizeGrams: 250, grind: 'whole-bean' }, { grind: 'Whole bean' }, t)).toBe('250 g · Whole bean');
    expect(variantSummary('machine', { colour: 'black', bundle: 'machine-only' }, { colour: 'Black', bundle: 'Machine only' }, t)).toBe('Black · Machine only');
    expect(variantSummary('accessory', { colour: 'cream' }, { colour: 'Cream' }, t)).toBe('Cream');
    expect(variantSummary('gift', {}, {}, t)).toBe('');
  });

  it('missing attributes are skipped, not printed as undefined', () => {
    expect(variantSummary('pods', { capsulesPerPack: 50 }, {}, t)).toBe('50 capsules');
  });
});

describe('freeShipping', () => {
  it('Threshold per market uses the market threshold and currency', () => {
    expect(freeShipping(usd(7500), [ln('delivery', 2500)])).toEqual({ threshold: usd(7500), remaining: usd(5000), reached: false });
    expect(freeShipping(cad(9900), [ln('delivery', 2500)])).toEqual({ threshold: cad(9900), remaining: cad(7400), reached: false });
  });

  it('progress counts only shippable lines', () => {
    const r = freeShipping(usd(7500), [ln('collect', 9000), ln('delivery', 1000), ln('subscribe', 500)]);
    expect(r.remaining).toEqual(usd(6000));
    expect(freeShipping(usd(7500), [ln('collect', 9000)])).toEqual({ threshold: usd(7500), remaining: null, reached: false });
  });

  it('reached at or above the threshold', () => {
    expect(freeShipping(usd(7500), [ln('delivery', 7500)])).toEqual({ threshold: usd(7500), remaining: null, reached: true });
  });

  it('no threshold in the market hides the block', () => {
    expect(freeShipping(null, [ln('delivery', 100)])).toEqual({ threshold: null, remaining: null, reached: false });
  });
});

describe('minimumOrder', () => {
  it('Below minimum order value states the shortfall amount', () => {
    expect(minimumOrder(usd(2000), 3000)).toEqual({ value: usd(3000), shortfall: usd(1000) });
    expect(minimumOrder(usd(3000), 3000)).toEqual({ value: usd(3000), shortfall: null });
  });

  it('minimum zero means off', () => {
    expect(minimumOrder(usd(1), 0)).toEqual({ value: null, shortfall: null });
    expect(minimumOrder(usd(1), undefined)).toEqual({ value: null, shortfall: null });
  });
});

describe('taxLabel', () => {
  it('Tax presentation included versus estimated', () => {
    expect(taxLabel({ amount: usd(100), included: true })).toBe('included');
    expect(taxLabel({ amount: usd(100), included: false })).toBe('estimated');
    expect(taxLabel(null)).toBe('later');
  });
});

describe('blockers', () => {
  const ok = { notices: [], unitPrice: usd(500) };
  it('blockers list', () => {
    expect(blockers([], false)).toEqual(['empty']);
    expect(blockers([ok], true)).toEqual(['below-minimum']);
    expect(blockers([{ ...ok, notices: [{ kind: 'out-of-stock' }] }], false)).toEqual(['out-of-stock']);
    expect(blockers([{ ...ok, notices: [{ kind: 'collect-unavailable' }] }], false)).toEqual(['collect-unavailable']);
    expect(blockers([{ ...ok, unitPrice: usd(0) }], false)).toEqual(['price-unavailable']);
  });

  it('price changes never block', () => {
    expect(blockers([{ ...ok, notices: [{ kind: 'price-updated', previous: usd(400) }] }], false)).toEqual([]);
  });
});

describe('discount reasons', () => {
  it('maps states and reasons to keys', () => {
    expect(stateReasonKey('MatchesCart')).toBeNull();
    expect(stateReasonKey('DoesNotMatchCart')).toBe('code.reason.DoesNotMatchCart');
    expect(rejectionKey('NotActive')).toBe('code.error.NotActive');
    expect(rejectionKey('Weird')).toBe('code.error.generic');
    expect(toCodeState('Nope')).toBe('NotValid');
    expect(toCodeState('MatchesCart')).toBe('MatchesCart');
  });
});
