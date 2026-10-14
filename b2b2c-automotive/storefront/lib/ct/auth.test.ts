// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, lineItem } from '@/test/cart-fixtures';

const loginPost = vi.hoisted(() => vi.fn());
const customersLogin = vi.hoisted(() => vi.fn());
const cartGet = vi.hoisted(() => vi.fn());
const cartPost = vi.hoisted(() => vi.fn());
const inStoreKey = vi.hoisted(() => vi.fn());
vi.mock('./client', () => {
  inStoreKey.mockImplementation(() => ({
    login: () => ({ post: (args: unknown) => ({ execute: () => loginPost(args) }) }),
    carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (args: unknown) => ({ execute: () => cartPost(args) }) }) }),
  }));
  return { apiRoot: { inStoreKeyWithStoreKeyValue: inStoreKey, customers: () => ({ login: customersLogin }) }, projectKey: 'p' };
});

import { AuthError, signIn } from './auth';

const customer = { id: 'cust-1', email: 'a@example.com', version: 1 };
const mergedCart = ctCart({ lineItems: [lineItem('li-1', 'BRK-1', 1, { list: 5000 }), lineItem('li-2', 'FLT-1', 1, { list: 1000 })] });

beforeEach(() => {
  for (const m of [loginPost, customersLogin, cartGet, cartPost]) m.mockReset();
  inStoreKey.mockClear();
  loginPost.mockResolvedValue({ body: { customer, cart: mergedCart } });
  cartGet.mockResolvedValue({ body: mergedCart });
  cartPost.mockResolvedValue({ body: mergedCart });
});

describe('signIn: lib/ct/auth', () => {
  it('uses login endpoint not customers login', async () => {
    await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw' });
    expect(inStoreKey).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north' });
    expect(loginPost).toHaveBeenCalledTimes(1);
    expect(customersLogin).not.toHaveBeenCalled();
  });
  it('passes anonymous cart with merge mode', async () => {
    await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw', anonymousCartId: 'anon-cart', anonymousId: 'anon-1' });
    expect(loginPost.mock.calls[0][0].body).toMatchObject({
      email: 'a@example.com',
      password: 'pw',
      anonymousCart: { typeId: 'cart', id: 'anon-cart' },
      anonymousCartSignInMode: 'MergeWithExistingCustomerCart',
      anonymousId: 'anon-1',
    });
  });
  it('no cart argument when session has no cart', async () => {
    await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw' });
    const body = loginPost.mock.calls[0][0].body;
    expect(body.anonymousCart).toBeUndefined();
    expect(body.anonymousCartSignInMode).toBeUndefined();
  });
  it('wrong password and other-store customer give the same error', async () => {
    loginPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidCredentials' }] } });
    const wrong = await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'bad' }).catch((e) => e);
    loginPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidCredentials', message: 'customer is in another store' }] } });
    const other = await signIn({ storeKey: 'mau-reseller-south', email: 'a@example.com', password: 'pw' }).catch((e) => e);
    expect(wrong).toBeInstanceOf(AuthError);
    expect(other).toBeInstanceOf(AuthError);
    expect(wrong.message).toBe(other.message);
    expect(wrong.code).toBe('invalid-credentials');
  });
  it('an outage is not reported as bad credentials', async () => {
    loginPost.mockRejectedValue({ statusCode: 503 });
    await expect(signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw' })).rejects.toMatchObject({ statusCode: 503 });
  });
  it('merged cart is recalculated', async () => {
    const out = await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw', anonymousCartId: 'anon-cart' });
    expect(cartPost.mock.calls[0][0].body.actions).toEqual([{ action: 'recalculate', updateProductData: true }]);
    expect(out.cart?.id).toBe('cart-1');
  });
  it('merge keeps both lines without duplicates', async () => {
    const out = await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw', anonymousCartId: 'anon-cart' });
    expect(out.cart?.lineItems.map((l) => l.variant.sku)).toEqual(['BRK-1', 'FLT-1']);
  });
  it('a customer without a cart returns none and recalculates nothing', async () => {
    loginPost.mockResolvedValue({ body: { customer } });
    const out = await signIn({ storeKey: 'mau-reseller-north', email: 'a@example.com', password: 'pw' });
    expect(out.cart).toBeNull();
    expect(cartPost).not.toHaveBeenCalled();
  });
});
