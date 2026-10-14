/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { ACTIVATION_FEE_TAX_CATEGORY_KEY, MAX_PHONE_LINES, minimumOrderValues, QUANTITY_RULES } from './cart';
import { DISCOUNT_AMOUNTS, DISCOUNT_KEYS } from './discounts';

describe('cart config', () => {
  it('the minimum order has USD and EUR integers (cents), by default 30 and 28', () => {
    expect(minimumOrderValues({})).toEqual({ USD: 3000, EUR: 2800 });
  });

  it('MINIMUM_ORDER_USD / MINIMUM_ORDER_EUR override it, 0 disables, anything invalid is ignored', () => {
    expect(minimumOrderValues({ MINIMUM_ORDER_USD: '0', MINIMUM_ORDER_EUR: ' 1500 ' })).toEqual({ USD: 0, EUR: 1500 });
    expect(minimumOrderValues({ MINIMUM_ORDER_USD: '-5', MINIMUM_ORDER_EUR: '12.5' })).toEqual({ USD: 3000, EUR: 2800 });
    expect(minimumOrderValues({ MINIMUM_ORDER_USD: '', MINIMUM_ORDER_EUR: 'abc' })).toEqual({ USD: 3000, EUR: 2800 });
  });

  it('phone plans take 1 to 5 lines, every other plan exactly 1', () => {
    expect(QUANTITY_RULES.plan_phone).toEqual({ min: 1, max: MAX_PHONE_LINES });
    expect(MAX_PHONE_LINES).toBe(5);
    expect(QUANTITY_RULES.plan_other).toEqual({ min: 1, max: 1 });
  });

  it('the fee tax category is the placeholder category F seeded', () => {
    expect(ACTIVATION_FEE_TAX_CATEGORY_KEY).toBe('malva-telecom-services');
  });

  it('DISCOUNT_AMOUNTS are integers in USD and EUR and the keys are malva-cd- keys', () => {
    for (const amounts of Object.values(DISCOUNT_AMOUNTS)) {
      expect(Number.isInteger(amounts.USD)).toBe(true);
      expect(Number.isInteger(amounts.EUR)).toBe(true);
    }
    for (const key of Object.values(DISCOUNT_KEYS)) expect(key.startsWith('malva-cd-')).toBe(true);
  });
});
