import { describe, expect, it } from 'vitest';
import { validateRule, type CartRule, type ProductRule } from './discount-rule';
import { EMPTY_FORM, formFromRule, ruleFromForm } from './discount-form';

describe('discount form', () => {
  it('round-trips a cart rule (total at least, percent, code, schedule)', () => {
    const rule: CartRule = { name: { 'de-DE': 'Warenkorb -3%', 'en-US': 'Cart -3%' }, condition: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { kind: 'relative', percent: 3 }, stacking: 'StopAfterThisDiscount', code: 'SAVE3', validFrom: '2026-11-01T00:00:00.000Z', validUntil: '2026-12-01T23:59:59.000Z' };
    const form = formFromRule(rule, 'en-US');
    expect(form).toMatchObject({ conditionKind: 'cartTotalAtLeast', amount: '2000.00', value: '3', code: 'SAVE3', validFrom: '2026-11-01', validUntil: '2026-12-01', stacking: 'StopAfterThisDiscount' });
    expect(ruleFromForm(form, 'cart')).toEqual(rule);
  });

  it('round-trips a product rule with SKUs and an absolute amount, with decimal commas in de-DE', () => {
    const rule: ProductRule = { name: { 'en-US': 'Fixed' }, scope: { kind: 'skus', skus: ['MLV-WB-90015', 'MLV-BP-41001'] }, effect: { kind: 'absolute', centAmount: 200 } };
    const form = formFromRule(rule, 'de-DE');
    expect(form.value).toBe('2,00');
    expect(ruleFromForm(form, 'product')).toEqual(rule);
  });

  it('unparseable numbers become values the validator rejects with the field', () => {
    const rule = ruleFromForm({ ...EMPTY_FORM, nameEn: 'x', effectKind: 'relative', value: 'abc' }, 'product');
    expect(validateRule(rule)[0]?.field).toBe('effect');
    const cart = ruleFromForm({ ...EMPTY_FORM, nameEn: 'x', conditionKind: 'cartTotalAtLeast', amount: '', effectKind: 'relative', value: '5' }, 'cart');
    expect(validateRule(cart)[0]?.field).toBe('condition');
    expect(validateRule(ruleFromForm({ ...EMPTY_FORM, nameEn: 'x', value: '0' }, 'product'))[0]?.field).toBe('effect');
    expect(validateRule(ruleFromForm({ ...EMPTY_FORM, value: '5' }, 'product'))[0]?.field).toBe('name');
  });

  it('free shipping needs no value; the code is upper-cased', () => {
    const rule = ruleFromForm({ ...EMPTY_FORM, nameEn: 'Ship', effectKind: 'freeShipping', code: ' ship1 ' }, 'cart') as CartRule;
    expect(rule.effect).toEqual({ kind: 'freeShipping' });
    expect(rule.code).toBe('SHIP1');
    expect(validateRule(rule)).toEqual([]);
  });
});
