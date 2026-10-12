import { describe, expect, it } from 'vitest';
import {
  compileCartDiscount,
  compileProductDiscount,
  describeRule,
  previewRule,
  validateRule,
  type CartRule,
  type ProductRule,
} from './discount-rule';

const productRule: ProductRule = { name: { 'de-DE': 'Bremsen -8%', 'en-US': 'Brakes -8%' }, scope: { kind: 'category', categoryId: 'cat-brakes', label: 'Brakes' }, effect: { kind: 'relative', percent: 8 } };
const cartRule: CartRule = { name: { 'de-DE': 'Warenkorb -3%', 'en-US': 'Cart -3%' }, condition: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking' };

describe('compile', () => {
  it('compile product example equals the JSON in T-01 (category scope, store channel clause appended)', () => {
    expect(compileProductDiscount(productRule, 'chan-north', { key: 'mau-reseller-north-brakes8-k3f9', sortOrder: '0.4172835961' })).toEqual({
      key: 'mau-reseller-north-brakes8-k3f9',
      name: { 'de-DE': 'Bremsen -8%', 'en-US': 'Brakes -8%' },
      value: { type: 'relative', permyriad: 800 },
      predicate: 'categories.id contains any ("cat-brakes") and channel.id = "chan-north"',
      sortOrder: '0.4172835961',
      isActive: false,
    });
  });

  it('compile cart example equals the JSON in T-01 (stores and the fundedBy reseller custom type)', () => {
    expect(compileCartDiscount(cartRule, 'mau-reseller-north', { key: 'mau-reseller-north-cart3-x2p8', sortOrder: '0.3318264957' })).toEqual({
      key: 'mau-reseller-north-cart3-x2p8',
      name: { 'de-DE': 'Warenkorb -3%', 'en-US': 'Cart -3%' },
      value: { type: 'relative', permyriad: 300 },
      target: { type: 'totalPrice' },
      cartPredicate: 'totalPrice >= "2000.00 EUR"',
      stores: [{ typeId: 'store', key: 'mau-reseller-north' }],
      custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'reseller', storeKey: 'mau-reseller-north' } },
      stackingMode: 'Stacking',
      requiresDiscountCode: false,
      sortOrder: '0.3318264957',
      isActive: false,
    });
  });

  it('free shipping targets shipping with a 100% relative value; a code sets requiresDiscountCode', () => {
    const draft = compileCartDiscount({ ...cartRule, effect: { kind: 'freeShipping' }, code: 'FREE-SHIP' }, 'mau-reseller-south');
    expect(draft.target).toEqual({ type: 'shipping' });
    expect(draft.value).toEqual({ type: 'relative', permyriad: 10000 });
    expect(draft.requiresDiscountCode).toBe(true);
  });

  it('absolute amounts carry one money entry per currency; the schedule is copied', () => {
    const draft = compileProductDiscount({ ...productRule, effect: { kind: 'absolute', centAmount: 200 }, validFrom: '2026-11-01T00:00:00Z', validUntil: '2026-12-01T00:00:00Z' }, 'c1', { currencies: ['EUR', 'USD'] });
    expect(draft.value).toEqual({ type: 'absolute', money: [{ currencyCode: 'EUR', centAmount: 200 }, { currencyCode: 'USD', centAmount: 200 }] });
    expect(draft.validFrom).toBe('2026-11-01T00:00:00Z');
  });

  it('predicate rejects ids with quotes', () => {
    expect(() => compileProductDiscount({ ...productRule, scope: { kind: 'category', categoryId: 'x") or true or ("', label: 'x' } }, 'c1')).toThrow();
    expect(() => compileProductDiscount({ ...productRule, scope: { kind: 'skus', skus: ['A", "B'] } }, 'c1')).toThrow();
    expect(() => compileProductDiscount(productRule, 'c1" or true')).toThrow();
    expect(() => compileCartDiscount(cartRule, 'store" or true')).toThrow();
  });

  it('sku scope lists the SKUs', () => {
    expect(compileProductDiscount({ ...productRule, scope: { kind: 'skus', skus: ['MLV-WB-90015', 'MLV-BP-41001'] } }, 'c1').predicate).toBe('sku in ("MLV-WB-90015", "MLV-BP-41001") and channel.id = "c1"');
  });
});

describe('describeRule', () => {
  it('describes the cart rule in plain language in both locales', () => {
    expect(describeRule(cartRule, 'en-US', 'EUR')).toBe('−3% on carts of €2,000 or more');
    expect(describeRule(cartRule, 'de-DE', 'EUR')).toContain('Warenkörbe ab');
  });
  it('describes product scope and effect', () => {
    expect(describeRule(productRule, 'en-US')).toBe('−8% on Category · Brakes');
    expect(describeRule({ ...productRule, scope: { kind: 'skus', skus: ['MLV-WB-90015'] }, effect: { kind: 'absolute', centAmount: 200 } }, 'en-US')).toContain('MLV-WB-90015');
  });
});

describe('previewRule', () => {
  it('previewRule: -3% on 2500.00 gives -75.00 as a named line', () => {
    const preview = previewRule(cartRule, { lines: [{ sku: 'A', unitCents: 250000, quantity: 1 }] });
    expect(preview.applies).toBe(true);
    expect(preview.lines).toEqual([{ label: 'Warenkorb -3%', cents: -7500 }]);
    expect(preview.totalAfter).toBe(242500);
  });
  it('does not apply below the threshold', () => {
    expect(previewRule(cartRule, { lines: [{ sku: 'A', unitCents: 150000, quantity: 1 }] }).applies).toBe(false);
  });
  it('product rule applies to matching lines only', () => {
    const preview = previewRule(productRule, { lines: [{ sku: 'A', categoryId: 'cat-brakes', unitCents: 10000, quantity: 2 }, { sku: 'B', categoryId: 'cat-x', unitCents: 10000, quantity: 1 }] });
    expect(preview.savingsCents).toBe(1600);
  });
  it('free shipping saves the shipping cost', () => {
    const preview = previewRule({ ...cartRule, effect: { kind: 'freeShipping' } }, { lines: [{ sku: 'A', unitCents: 250000, quantity: 1 }], shippingCents: 590 });
    expect(preview.savingsCents).toBe(590);
  });
});

describe('validateRule', () => {
  it('validateRule rejects 0%, 101%, from after until', () => {
    expect(validateRule({ ...cartRule, effect: { kind: 'relative', percent: 0 } })[0]?.field).toBe('effect');
    expect(validateRule({ ...cartRule, effect: { kind: 'relative', percent: 101 } })[0]?.field).toBe('effect');
    expect(validateRule({ ...cartRule, validFrom: '2026-12-01T00:00:00Z', validUntil: '2026-11-01T00:00:00Z' })[0]?.field).toBe('validUntil');
    expect(validateRule({ ...cartRule, effect: { kind: 'absolute', centAmount: 0 } })[0]?.field).toBe('effect');
  });
  it('accepts 0.01 and 100 percent and has no floor or cost rule', () => {
    expect(validateRule({ ...cartRule, effect: { kind: 'relative', percent: 0.01 } })).toEqual([]);
    expect(validateRule({ ...cartRule, effect: { kind: 'relative', percent: 100 } })).toEqual([]);
    expect(validateRule(productRule)).toEqual([]);
  });
  it('checks code format and sku lists', () => {
    expect(validateRule({ ...cartRule, code: 'a b' })[0]?.field).toBe('code');
    expect(validateRule({ ...productRule, scope: { kind: 'skus', skus: [] } })[0]?.field).toBe('scope');
  });
});
