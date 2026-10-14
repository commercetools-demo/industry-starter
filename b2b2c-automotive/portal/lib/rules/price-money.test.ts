/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { assertValidPrice, centMoney, RuleViolation } from './price-money';

const base = { type: 'centPrecision', currencyCode: 'EUR', centAmount: 9000, fractionDigits: 2 };

describe('assertValidPrice', () => {
  it('0, negative, 3 decimals, other currency, highPrecision are INVALID_MONEY; 1 cent passes', () => {
    const bad = [
      { ...base, centAmount: 0 },
      { ...base, centAmount: -500 },
      { ...base, centAmount: 9000.5 }, // 90.005
      { ...base, fractionDigits: 3 },
      { ...base, currencyCode: 'USD' },
      { ...base, type: 'highPrecision' },
    ];
    for (const price of bad) {
      let error: unknown;
      try {
        assertValidPrice({ price, currency: 'EUR' });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(RuleViolation);
      expect((error as RuleViolation).code).toBe('INVALID_MONEY');
      expect((error as RuleViolation).status).toBe(400);
    }
    expect(() => assertValidPrice({ price: centMoney(1, 'EUR'), currency: 'EUR' })).not.toThrow();
    expect(() => assertValidPrice({ price: centMoney(10, 'USD'), currency: 'USD' })).not.toThrow();
  });

  it('a price far below any list price is valid (no floor)', () => {
    expect(() => assertValidPrice({ price: centMoney(1, 'EUR'), currency: 'EUR' })).not.toThrow();
  });
});
