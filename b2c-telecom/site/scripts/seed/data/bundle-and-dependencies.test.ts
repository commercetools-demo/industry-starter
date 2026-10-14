/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { cartDiscounts } from './cart-discounts';
import { attr, masterAttr, product, variantsOf } from './manifest-access';
import { BUNDLE_OFFER_KEY, BUNDLE_PRICES } from './prices';

const bundle = () => product(BUNDLE_OFFER_KEY);

describe('the bundle offer', () => {
  it('is an offer of kind bundle that anchors the cable plan and a phone plan and includes the modem and the phone plan', () => {
    expect(masterAttr(bundle(), 'offer-kind')).toBe('bundle');
    expect(masterAttr(bundle(), 'anchors')).toEqual(['malva-cable-500', 'malva-phone-essential']);
    expect(masterAttr(bundle(), 'included-offers')).toEqual(['malva-offer-modem-docsis31', 'malva-offer-phone-essential']);
  });

  it('has its own price and a price for each of two customer groups, in both markets; the standard price remains', () => {
    const variant = variantsOf(bundle())[0]!;
    const monthly = (currency: string, group?: string) => variant.prices.find((p) => p.value.currencyCode === currency && p.recurrencePolicy && p.customerGroup === group);
    expect(monthly('USD')?.value.centAmount).toBe(BUNDLE_PRICES.usd);
    expect(monthly('USD', 'small-business')?.value.centAmount).toBe(5900);
    expect(monthly('USD', 'existing-customer')?.value.centAmount).toBe(6500);
    expect(monthly('EUR', 'small-business')).toMatchObject({ country: 'DE' });
    expect(new Set(variant.prices.map((p) => p.key)).size).toBe(variant.prices.length);
  });

  it('gets its bundled price from the offer, never from a cart discount', () => {
    expect(cartDiscounts.map((d) => d.key).filter((key) => /bundle/.test(key))).toEqual([]);
  });

  it('conflicts with every other home-internet offer, like any internet plan', () => {
    const conflicts = attr(bundle().masterVariant, 'conflicts-with') as string[];
    expect(conflicts).toContain('malva-offer-cable-500');
    expect(conflicts).not.toContain(BUNDLE_OFFER_KEY);
    expect(attr(product('malva-offer-cable-500').masterVariant, 'conflicts-with')).toContain(BUNDLE_OFFER_KEY);
  });
});

describe('plans that require an installation choice', () => {
  it('Cable 100 requires an installation add-on; the plans that include installation require nothing', () => {
    expect(masterAttr(product('malva-cable-100'), 'required-addon-kinds')).toEqual(['installation']);
    expect(masterAttr(product('malva-cable-500'), 'required-addon-kinds')).toBeUndefined();
  });
});
