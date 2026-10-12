// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session }));
const prepare = vi.hoisted(() => vi.fn());
const createOrder = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: async () => null }));
vi.mock('@/lib/ct/orders', () => ({ createDevOrderFromCart: createOrder }));
vi.mock('@/lib/ct/checkout-prepare', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ct/checkout-prepare')>('@/lib/ct/checkout-prepare');
  return { ...actual, prepareCartForCheckout: prepare };
});

import { POST } from './route';

const post = (body: unknown) => POST(makeRequest('/api/dev/checkout/complete', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv('CHECKOUT_DEV_COMPLETE', 'true');
  vi.stubEnv('NODE_ENV', 'development');
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1' };
  prepare.mockReset().mockResolvedValue({});
  createOrder.mockReset().mockResolvedValue({ id: '3f1c0c52-1111-4222-8333-944455556666', orderNumber: 'MA-0123ABCD' });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/dev/checkout/complete', () => {
  it('route is 404 in production even with the flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await post({ customerEmail: 'qa@example.com' })).status).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
  });
  it('route is 404 without the flag', async () => {
    vi.stubEnv('CHECKOUT_DEV_COMPLETE', '');
    expect((await post({ customerEmail: 'qa@example.com' })).status).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
  });
  it('needs an example.com email', async () => {
    for (const customerEmail of ['real@gmail.com', 'x@example.com.evil.org', 'nope']) expect((await post({ customerEmail })).status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });
  it('creates one order tagged isTest through prepare and answers the return URL', async () => {
    const res = await post({ customerEmail: 'qa-1@example.com' });
    expect(await res.json()).toEqual({ redirect: '/checkout/return?orderId=3f1c0c52-1111-4222-8333-944455556666' });
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north', cartId: 'cart-1', customerEmail: 'qa-1@example.com' });
    expect(prepare).toHaveBeenCalledTimes(1); // prepare is what writes isTest outside production (prepare.test.ts)
  });
  it('409 without a cart', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    expect((await post({ customerEmail: 'qa@example.com' })).status).toBe(409);
  });
  it('creates no payment: the module never touches payments', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, 'route.ts'), 'utf8');
    expect(text).not.toMatch(/payments\(\)/);
  });
});
