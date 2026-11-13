import { describe, expect, it } from 'vitest';
import { minorToMajor, unitPriceMajor } from './money';

describe('money', () => {
  it('Money honours fraction digits', () => {
    expect(minorToMajor(34900, 'USD')).toBe(349);
    expect(minorToMajor(1999, 'CAD')).toBe(19.99);
    expect(minorToMajor(500, 'JPY')).toBe(500);
    expect(minorToMajor(1234, 'BHD')).toBe(1.234);
  });

  it('Unit price is lineTotal over quantity and zero quantity is zero', () => {
    expect(unitPriceMajor(5997, 3, 'USD')).toBe(19.99);
    expect(unitPriceMajor(1000, 0, 'USD')).toBe(0);
    expect(Number.isNaN(unitPriceMajor(1000, Number.NaN, 'USD'))).toBe(false);
    // A line with a per-line discount: 3 units, 25.00 total: the effective unit price times the quantity is the platform's line total.
    expect(Math.round(unitPriceMajor(2500, 3, 'USD') * 3 * 100)).toBe(2500);
  });
});
