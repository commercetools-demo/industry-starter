import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import { DISCOUNT_APPLICATION_ORDER, DISCOUNT_KEYS } from '../../../lib/config/discounts';
import { cartDiscounts } from './cart-discounts';
import { cable5Discount } from './cart-discounts/code-cable5';
import { discountCodes } from './discount-codes';
import type { ProductTypeDraft, SeedManifest } from '../types';
import { validateManifest } from '../validate';
import { reconcilers } from '../reconcilers/registry';
import { FakeCt } from '../test/fake-ct';

const discount = (key: string) => {
  const found = cartDiscounts.find((d) => d.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe('cart discounts and codes', () => {
  it('two discounts plus the code discount, all active and stacking, with unique sort orders', () => {
    const all = [...cartDiscounts, cable5Discount];
    expect(all.map((d) => d.key).sort()).toEqual([...DISCOUNT_APPLICATION_ORDER].sort());
    expect(new Set(all.map((d) => d.sortOrder)).size).toBe(all.length);
    for (const d of all) {
      expect(d.isActive).toBe(true);
      expect(d.stackingMode).toBe('Stacking');
    }
    expect(discount(DISCOUNT_KEYS.welcome10).requiresDiscountCode).toBe(true);
    expect(discount(DISCOUNT_KEYS.introFreeMonth).requiresDiscountCode).toBe(false);
  });

  it('every discount applies to the first order only (promotions never reach recurring orders)', () => {
    for (const d of [...cartDiscounts, cable5Discount]) expect(d.recurringOrderScope, d.key).toEqual({ type: 'NonRecurringOrdersOnly' });
  });

  it('the platform applies the HIGHER sortOrder first, so the seed ranks follow DISCOUNT_APPLICATION_ORDER from high to low', () => {
    const all = [...cartDiscounts, cable5Discount];
    const ranks = DISCOUNT_APPLICATION_ORDER.map((key) => Number(all.find((d) => d.key === key)?.sortOrder));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(new Set(ranks).size).toBe(ranks.length);
    // the percentage promotion is applied before the absolute code, and the total-price discount is the last of the three
    expect(DISCOUNT_APPLICATION_ORDER[0]).toBe(DISCOUNT_KEYS.introFreeMonth);
    expect(DISCOUNT_APPLICATION_ORDER[DISCOUNT_APPLICATION_ORDER.length - 1]).toBe(DISCOUNT_KEYS.welcome10);
  });

  it('predicates only use attributes defined with savedToLineItem: true (via the framework validator)', async () => {
    const api = new FakeCt();
    api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
    api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
    const errors = await validateManifest(api, MANIFEST, reconcilers);
    expect(errors).toEqual([]);
    // negative control: the same manifest with the line item flag removed is rejected
    const offerType = (MANIFEST.productType as ProductTypeDraft[]).find((t) => t.key === 'malva-offer') as ProductTypeDraft;
    const broken: SeedManifest = { ...MANIFEST, productType: [{ ...offerType, attributes: offerType.attributes.map((a) => ({ ...a, savedToLineItem: false })) } as ProductTypeDraft] };
    const rejected = await validateManifest(api, broken, reconcilers);
    expect(rejected.some((e) => e.message.includes('intro-free-months'))).toBe(true);
  });

  it('first month free and welcome discounts follow the table', () => {
    expect(discount('malva-cd-intro-free-month').value).toEqual({ type: 'relative', permyriad: 10000 });
    expect(discount('malva-cd-intro-free-month').target).toEqual({ type: 'lineItems', predicate: 'attributes.`intro-free-months` > 0' });
    expect(discount('malva-cd-welcome-10').target).toEqual({ type: 'totalPrice' });
  });

  it('retired discounts are gone', () => {
    const keys = cartDiscounts.map((d) => d.key);
    for (const retired of ['malva-cd-second-line-10', 'malva-cd-bundle-5', 'malva-cd-tier-year1-20', 'malva-cd-tier-year1-15']) expect(keys).not.toContain(retired);
  });

  it('the welcome code WELCOME10 points at the welcome discount', () => {
    expect(discountCodes).toHaveLength(1);
    expect(discountCodes[0]).toMatchObject({ key: 'malva-dc-welcome10', code: 'WELCOME10', cartDiscounts: ['malva-cd-welcome-10'], isActive: true });
    expect(discountCodes[0].name).toEqual({ 'en-US': 'Welcome offer', 'de-DE': 'Willkommensangebot' });
  });
});
