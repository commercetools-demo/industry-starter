// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, lineItem, money, shippingPromo, welcome } from '@/test/cart-fixtures';

const cartGet = vi.hoisted(() => vi.fn());
const cartPost = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (args: unknown) => ({ execute: () => cartPost(args) }) }) }),
    }),
  },
  projectKey: 'p',
}));

import { applyPromoCode, collectSavings, mapPromoCodes, removePromoCode } from './cart-discounts';

const codeEntry = (state: string, code = 'MALVA-WELCOME5') => ({ discountCode: { typeId: 'discount-code', id: 'dc-1', obj: { code } }, state });

beforeEach(() => {
  cartGet.mockReset();
  cartPost.mockReset();
  cartGet.mockResolvedValue({ body: ctCart() });
});

describe('collectSavings: named savings', () => {
  it('each discount is its own named line', () => {
    const savings = collectSavings(ctCart(), 'en-US', 'Discount');
    expect(savings.map((s) => [s.name, s.amount.centAmount])).toEqual([
      ['Brake week −8%', 800],
      ['Welcome −5%', 50],
    ]);
  });
  it('same discount on two lines is merged', () => {
    const cart = ctCart({
      lineItems: [lineItem('a', 'A', 2, { list: 1000, cartDiscount: { discount: welcome, perUnit: 50 } }), lineItem('b', 'B', 1, { list: 2000, cartDiscount: { discount: welcome, perUnit: 100 } })],
    });
    expect(collectSavings(cart, 'de-DE', 'Rabatt')).toEqual([{ discountId: 'cd-welcome', name: 'Willkommen −5 %', amount: money(200) }].map((s) => ({ ...s, amount: { centAmount: 200, currencyCode: 'EUR', fractionDigits: 2 } })));
  });
  it('product discount is named from its expanded reference', () => {
    expect(collectSavings(ctCart(), 'de-DE', 'Rabatt')[0].name).toBe('Bremsen-Woche −8 %');
  });
  it('savings fall back to key then generic text', () => {
    const noName = { typeId: 'cart-discount', id: 'cd-x', obj: { key: 'mau-cd-x', name: {} } };
    const bare = { typeId: 'cart-discount', id: 'cd-y' };
    const cart = ctCart({
      lineItems: [lineItem('a', 'A', 1, { list: 1000, cartDiscount: { discount: noName, perUnit: 10 } }), lineItem('b', 'B', 1, { list: 1000, cartDiscount: { discount: bare, perUnit: 20 } })],
    });
    expect(collectSavings(cart, 'en-US', 'Savings').map((s) => s.name)).toEqual(['mau-cd-x', 'Savings']);
  });
  it('includes the total price discount and the shipping discount', () => {
    const cart = ctCart({
      lineItems: [],
      discountOnTotalPrice: { discountedAmount: money(300), includedDiscounts: [{ discount: welcome, discountedAmount: money(300) }] },
      shippingInfo: { price: money(590), discountedPrice: { value: money(0), includedDiscounts: [{ discount: shippingPromo, discountedAmount: money(590) }] } },
    });
    expect(collectSavings(cart, 'en-US', 'x').map((s) => [s.name, s.amount.centAmount])).toEqual([
      ['Welcome −5%', 300],
      ['Free shipping', 590],
    ]);
  });
});

describe('promo codes', () => {
  it('code that matches is applied', async () => {
    cartPost.mockResolvedValue({ body: ctCart({ discountCodes: [codeEntry('MatchesCart')] }) });
    const out = await applyPromoCode('mau-reseller-north', 'cart-1', ' MALVA-WELCOME5 ');
    expect(cartPost.mock.calls[0][0].body.actions).toEqual([{ action: 'addDiscountCode', code: 'MALVA-WELCOME5' }]);
    expect(out.promo).toEqual({ code: 'MALVA-WELCOME5', id: 'dc-1', state: 'applied', reason: null });
    expect(out.cart).not.toBeNull();
  });
  it('code that does not match is not applied with reason and totals unchanged', async () => {
    const before = ctCart();
    cartPost.mockResolvedValue({ body: ctCart({ discountCodes: [codeEntry('DoesNotMatchCart', 'SUEDKAMM-BRAKE5')] }) });
    const out = await applyPromoCode('mau-reseller-north', 'cart-1', 'SUEDKAMM-BRAKE5');
    expect(out.promo).toMatchObject({ state: 'not-applied', reason: 'does-not-match' });
    expect(out.cart?.totalPrice).toEqual(before.totalPrice);
  });
  it('unknown code does not mutate the cart', async () => {
    cartPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'DiscountCodeNonApplicable', reason: 'DoesNotExist' }] } });
    const out = await applyPromoCode('mau-reseller-north', 'cart-1', 'NONSENSE');
    expect(out.cart).toBeNull();
    expect(out.promo).toEqual({ code: 'NONSENSE', id: '', state: 'not-applied', reason: 'not-valid' });
  });
  it('maps every commercetools state to a reason', () => {
    const states = ['NotActive', 'NotValid', 'MaxApplicationReached', 'ApplicationStoppedByPreviousDiscount'];
    const mapped = mapPromoCodes(ctCart({ discountCodes: states.map((s) => codeEntry(s)) }));
    expect(mapped.map((p) => p.reason)).toEqual(['not-active', 'not-valid', 'max-reached', 'stopped-by-previous']);
  });
  it('remove code', async () => {
    cartPost.mockResolvedValue({ body: ctCart() });
    await removePromoCode('mau-reseller-north', 'cart-1', 'dc-1');
    expect(cartPost.mock.calls[0][0].body.actions).toEqual([{ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: 'dc-1' } }]);
  });
  it('a malformed code is rejected without a call', async () => {
    const out = await applyPromoCode('mau-reseller-north', 'cart-1', 'bad code!');
    expect(out.promo.reason).toBe('not-valid');
    expect(cartPost).not.toHaveBeenCalled();
  });
});

describe('Direct Discounts are never used (D7)', () => {
  it('no direct discounts are ever sent', () => {
    for (const file of ['cart-discounts.ts', 'cart.ts', 'delivery.ts']) {
      expect(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')).not.toMatch(/setDirectDiscounts/);
    }
  });
});
