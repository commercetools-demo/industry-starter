// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { isValidDiscount, presetPrice } from '@/lib/preset-bundle/pricing';

describe('presetPrice (D2 worked example, US)', () => {
  it('Vertuo bundle: 38795 × 0.9 rounds to 34916, saves 3879', () => {
    expect(presetPrice([15900, 17900, 4995], 0.1)).toEqual({ was: 38795, price: 34916, save: 3879 });
  });

  it('Pod plus: 47290 × 0.88 rounds to 41615, saves 5675', () => {
    expect(presetPrice([21900, 4995, 17900, 2495], 0.12)).toEqual({ was: 47290, price: 41615, save: 5675 });
  });

  it('a discount of 0 is valid and saves nothing', () => {
    expect(presetPrice([1000, 500], 0)).toEqual({ was: 1500, price: 1500, save: 0 });
  });

  it('rounds once, after the sum', () => {
    // Per-part rounding would give Math.round(0.5) × 3 = 3; the sum rounds once: round(1.5) = 2.
    expect(presetPrice([1, 1, 1], 0.5)).toEqual({ was: 3, price: 2, save: 1 });
  });

  it('refuses an empty preset and a non-integer part', () => {
    expect(presetPrice([], 0.1)).toBeNull();
    expect(presetPrice([10.5], 0.1)).toBeNull();
    expect(presetPrice([-1], 0.1)).toBeNull();
  });
});

describe('isValidDiscount', () => {
  it.each([-0.1, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '0.1', null, undefined])('%s is invalid', (value) => {
    expect(isValidDiscount(value)).toBe(false);
    expect(presetPrice([1000], value)).toBeNull();
  });

  it.each([0, 0.1, 0.99])('%s is valid', (value) => {
    expect(isValidDiscount(value)).toBe(true);
  });
});
