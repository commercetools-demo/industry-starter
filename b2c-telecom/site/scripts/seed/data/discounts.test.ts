import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import { cartDiscounts, SKU_YEAR1_GIG, SKU_YEAR1_MAX } from './cart-discounts';
import { discountCodes } from './discount-codes';
import { masterAttr, product, variantsOf } from './manifest-access';
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
  it('six discounts with unique sort orders 0.1 to 0.6, all active and stacking', () => {
    expect(cartDiscounts.map((d) => d.sortOrder)).toEqual(['0.1', '0.2', '0.3', '0.4', '0.5', '0.6']);
    expect(new Set(cartDiscounts.map((d) => d.sortOrder)).size).toBe(6);
    for (const d of cartDiscounts) {
      expect(d.isActive).toBe(true);
      expect(d.stackingMode).toBe('Stacking');
      expect(d.requiresDiscountCode).toBe(d.key === 'malva-cd-welcome-10');
    }
  });

  it('the year-1 percentages equal the first price step of their offer', () => {
    const steps = (offerKey: string): { fromMonth: number; percentOff: number }[] => JSON.parse(masterAttr(product(offerKey), 'price-steps') as string);
    expect(discount('malva-cd-tier-year1-20').value).toEqual({ type: 'relative', permyriad: steps('malva-offer-cable-gig')[0].percentOff * 100 });
    expect(discount('malva-cd-tier-year1-15').value).toEqual({ type: 'relative', permyriad: steps('malva-offer-phone-unlimited-max')[0].percentOff * 100 });
    expect(variantsOf(product('malva-offer-cable-gig')).map((v) => v.sku)).toContain(SKU_YEAR1_GIG);
    expect(variantsOf(product('malva-offer-phone-unlimited-max')).map((v) => v.sku)).toContain(SKU_YEAR1_MAX);
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
    expect(rejected.some((e) => e.message.includes('offer-family'))).toBe(true);
  });

  it('pattern target shape for the second-line discount', () => {
    const d = discount('malva-cd-second-line-10');
    expect(d.value).toEqual({
      type: 'absolute',
      money: [
        { currencyCode: 'USD', centAmount: 1000 },
        { currencyCode: 'EUR', centAmount: 1000 },
      ],
      applicationMode: 'IndividualApplication',
    });
    expect(d.target).toEqual({
      type: 'pattern',
      triggerPattern: [{ type: 'CountOnLineItemUnits', predicate: 'attributes.`offer-family` = "phone"', minCount: 1, maxCount: 1 }],
      targetPattern: [{ type: 'CountOnLineItemUnits', predicate: 'attributes.`offer-family` = "phone"', minCount: 1, maxCount: 4 }],
      maxOccurrence: 1,
      selectionMode: 'Cheapest',
    });
  });

  it('bundle, introductory month, tier and welcome discounts follow the table', () => {
    expect(discount('malva-cd-bundle-5').cartPredicate).toBe('lineItemExists(attributes.`offer-family` = "phone") = true and lineItemExists(attributes.`offer-family` in ("cable","fixed-wireless")) = true');
    expect(discount('malva-cd-bundle-5').target).toEqual({ type: 'lineItems', predicate: 'attributes.`offer-family` in ("cable","fixed-wireless")' });
    expect(discount('malva-cd-intro-free-month').value).toEqual({ type: 'relative', permyriad: 10000 });
    expect(discount('malva-cd-intro-free-month').recurringOrderScope).toEqual({ type: 'NonRecurringOrdersOnly' });
    expect(discount('malva-cd-welcome-10').target).toEqual({ type: 'totalPrice' });
    expect(discount('malva-cd-second-line-10').recurringOrderScope).toEqual({ type: 'AnyOrder' });
  });

  it('the welcome code WELCOME10 points at the welcome discount', () => {
    expect(discountCodes).toHaveLength(1);
    expect(discountCodes[0]).toMatchObject({ key: 'malva-dc-welcome10', code: 'WELCOME10', cartDiscounts: ['malva-cd-welcome-10'], isActive: true });
    expect(discountCodes[0].name).toEqual({ 'en-US': 'Welcome offer', 'de-DE': 'Willkommensangebot' });
  });
});
