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

import { applyPromoCode, codeCandidates, collectSavings, mapPromoCodes, normalizeCode, removePromoCode } from './cart-discounts';

const doesNotExist = { statusCode: 400, body: { errors: [{ code: 'DiscountCodeNonApplicable', reason: 'DoesNotExist' }] } };
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
    cartPost.mockRejectedValueOnce(doesNotExist);
    cartPost.mockResolvedValue({ body: ctCart({ discountCodes: [codeEntry('MatchesCart')] }) });
    const out = await applyPromoCode('mau-reseller-north', 'cart-1', ' MALVA-WELCOME5 ');
    expect(cartPost.mock.calls[1][0].body.actions).toEqual([{ action: 'addDiscountCode', code: 'MALVA-WELCOME5' }]);
    expect(out.promo).toEqual({ code: 'MALVA-WELCOME5', id: 'dc-1', state: 'applied', reason: null });
    expect(out.cart).not.toBeNull();
  });
  it('code that does not match is not applied with reason and totals unchanged', async () => {
    const before = ctCart();
    cartPost.mockRejectedValueOnce(doesNotExist);
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

describe('store-suffixed codes (W-02)', () => {
  const North = 'mau-reseller-north';
  const applied = (code: string) => ({ body: ctCart({ discountCodes: [codeEntry('MatchesCart', code)] }) });
  const sent = () => cartPost.mock.calls.map((c) => c[0].body.actions[0].code);

  it('BRAKE8 on store A applies BRAKE8-<A> and never BRAKE8-<B>', async () => {
    cartPost.mockResolvedValue(applied('BRAKE8-MAU-RESELLER-NORTH'));
    const out = await applyPromoCode(North, 'cart-1', 'brake8');
    expect(sent()).toEqual(['BRAKE8-MAU-RESELLER-NORTH']);
    expect(out.promo).toMatchObject({ state: 'applied' });
    expect(sent().join()).not.toContain('SOUTH');
  });
  it('falls back to the plain code when the suffixed one does not exist', async () => {
    cartPost.mockRejectedValueOnce(doesNotExist);
    cartPost.mockResolvedValueOnce(applied('BRAKE8'));
    const out = await applyPromoCode(North, 'cart-1', 'BRAKE8');
    expect(sent()).toEqual(['BRAKE8-MAU-RESELLER-NORTH', 'BRAKE8']);
    expect(out.promo).toMatchObject({ code: 'BRAKE8', state: 'applied' });
  });
  it('a suffixed code that exists but cannot apply reports its reason and does not try the plain code', async () => {
    cartPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'DiscountCodeNonApplicable', reason: 'NotActive' }] } });
    const out = await applyPromoCode(North, 'cart-1', 'BRAKE8');
    expect(sent()).toEqual(['BRAKE8-MAU-RESELLER-NORTH']);
    expect(out.promo).toMatchObject({ state: 'not-applied', reason: 'not-active' });
  });
  it('the store key comes from the argument and is upper cased', async () => {
    cartPost.mockResolvedValue(applied('X-MAU-RESELLER-SOUTH'));
    await applyPromoCode('mau-reseller-south', 'cart-1', 'x');
    expect(sent()).toEqual(['X-MAU-RESELLER-SOUTH']);
  });
  it('normalises: trims, upper cases, refuses more than 40 characters and characters outside A-Z 0-9 _ -', async () => {
    expect(normalizeCode('  brake_8-x ')).toBe('BRAKE_8-X');
    expect(normalizeCode('a'.repeat(41))).toBeNull();
    expect(normalizeCode('a'.repeat(40))).toBe('A'.repeat(40));
    expect(normalizeCode('bad code')).toBeNull();
    expect(normalizeCode('x;y')).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });
  it('candidates are the suffixed code first, then the plain one', () => {
    expect(codeCandidates('brake8', 'mau-reseller-north')).toEqual(['BRAKE8-MAU-RESELLER-NORTH', 'BRAKE8']);
    expect(codeCandidates('no way', 'mau-reseller-north')).toEqual([]);
  });
});

describe('Direct Discounts are never used (D7)', () => {
  it('no direct discounts are ever sent', () => {
    for (const file of ['cart-discounts.ts', 'cart.ts', 'delivery.ts']) {
      expect(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')).not.toMatch(/setDirectDiscounts/);
    }
  });
});
