/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { EMPLOYEE_PLAN_KEYS } from './offers/helpers';
import { SMALL_BUSINESS_PLAN_DROP_CENTS } from './prices';
import { masterAttr, OFFERS } from './manifest-access';

const PLAN_KINDS = ['base-package', 'bundle'];
const kindOf = (offer: (typeof OFFERS)[number]) => masterAttr(offer, 'offer-kind');

describe('audience and group prices of the plans', () => {
  it('employees may buy exactly one plan per family: Unlimited, Unlimited Max, 5G Plus and Cable Gig', () => {
    const open = OFFERS.filter((offer) => PLAN_KINDS.includes(String(kindOf(offer)))).filter((offer) => (masterAttr(offer, 'audience') as string[]).includes('employee'));
    expect(open.map((offer) => offer.key).sort()).toEqual([...EMPLOYEE_PLAN_KEYS].sort());
  });

  it('add-ons, equipment and devices stay open to every audience', () => {
    for (const offer of OFFERS.filter((entry) => !PLAN_KINDS.includes(String(kindOf(entry))))) {
      expect(masterAttr(offer, 'audience') as string[], offer.key).toContain('employee');
    }
  });

  it('every plan variant but the bundle has a small-business price $5 below its standing price; nothing else has one', () => {
    for (const offer of OFFERS) {
      const isPlan = PLAN_KINDS.includes(String(kindOf(offer)));
      for (const variant of [offer.masterVariant, ...offer.variants]) {
        const monthly = variant.prices.filter((price) => price.recurrencePolicy && !price.customerGroup && !price.channel && price.value.currencyCode === 'USD');
        const grouped = variant.prices.filter((price) => price.customerGroup === 'small-business' && price.value.currencyCode === 'USD');
        if (!isPlan || offer.key === 'malva-offer-bundle-cable-phone') continue;
        expect(grouped, variant.sku).toHaveLength(1);
        expect(grouped[0]?.value.centAmount, variant.sku).toBe((monthly[0]?.value.centAmount ?? 0) - SMALL_BUSINESS_PLAN_DROP_CENTS);
      }
      if (!isPlan) expect(offer.masterVariant.prices.some((price) => price.customerGroup), offer.key).toBe(false);
    }
  });
});
