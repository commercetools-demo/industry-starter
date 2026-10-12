import { describe, expect, it } from 'vitest';
import { validateBundle, type BundleDraft } from './rules';

const prices = new Map<string, number | null>([['A', 1000], ['B', 2000], ['C', null], ['D', 0]]);
const base: BundleDraft = { name: 'TST-W bundle', discountPercent: 10, components: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }] };
const codes = (d: BundleDraft, cents?: number) => validateBundle(d, prices, cents).map((i) => i.code);

describe('bundle rules', () => {
  it('accepts a valid bundle', () => expect(codes(base, 2700)).toEqual([]));
  it('limits components to 2 to 8', () => {
    expect(codes({ ...base, components: [{ sku: 'A', qty: 1 }] })).toContain('COMPONENT_COUNT');
    expect(codes({ ...base, components: Array.from({ length: 9 }, (_, i) => ({ sku: `S${i}`, qty: 1 })) })).toContain('COMPONENT_COUNT');
  });
  it('limits quantity to 1 to 20', () => {
    expect(codes({ ...base, components: [{ sku: 'A', qty: 0 }, { sku: 'B', qty: 21 }] })).toEqual(['QUANTITY_RANGE', 'QUANTITY_RANGE']);
  });
  it('limits the discount to 1 to 50 percent', () => {
    expect(codes({ ...base, discountPercent: 60 })).toEqual(['DISCOUNT_RANGE']);
    expect(codes({ ...base, discountPercent: 0 })).toEqual(['DISCOUNT_RANGE']);
    expect(codes({ ...base, discountPercent: 50 })).toEqual([]);
  });
  it('limits the name length', () => {
    expect(codes({ ...base, name: 'ab' })).toEqual(['NAME_LENGTH']);
    expect(codes({ ...base, name: 'x'.repeat(81) })).toEqual(['NAME_LENGTH']);
  });
  it('refuses a bundle price of 0 and components without a price; there is no floor code', () => {
    expect(codes(base, 0)).toEqual(['BUNDLE_PRICE']);
    expect(codes({ ...base, components: [{ sku: 'C', qty: 1 }, { sku: 'D', qty: 1 }] })).toEqual(['COMPONENT_PRICE', 'COMPONENT_PRICE']);
    expect(JSON.stringify(validateBundle(base, prices, 1))).not.toMatch(/floor/i);
  });
});
