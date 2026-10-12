// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session, writes: [] as Session[] }));
const resolveReturn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }),
  updateSession: async (patch: (s: Session) => Session) => {
    state.session = patch(state.session);
    state.writes.push(state.session);
    return state.session;
  },
}));
vi.mock('@/lib/checkout/return', () => ({ resolveReturn }));

import { GET } from './route';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const path = '/en-US/mau-reseller-north/checkout/confirmation/MA-0123ABCD';
const ok = { status: 'ok', path, cartId: 'cart-1' };
const get = (query: string) => GET(makeRequest(`/checkout/return${query}`));

beforeEach(() => {
  resolveReturn.mockReset();
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1', anonymousId: 'a-1' };
  state.writes = [];
});

describe('GET /checkout/return', () => {
  it('return page redirects to the numbered confirmation', async () => {
    resolveReturn.mockResolvedValue(ok);
    const res = await get(`?orderId=${ID}`);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(path);
    expect(resolveReturn).toHaveBeenCalledWith({ orderId: ID, orderNumber: undefined }, expect.objectContaining({ anonymousId: 'a-1' }));
  });
  it('response has no-referrer and no-store', async () => {
    resolveReturn.mockResolvedValue(ok);
    const res = await get(`?orderId=${ID}`);
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('cartId is cleared from the session', async () => {
    resolveReturn.mockResolvedValue(ok);
    await get(`?orderId=${ID}`);
    expect(state.session.cartId).toBeUndefined();
    expect(state.session.anonymousId).toBe('a-1');
  });
  it('another cart stays in the session', async () => {
    resolveReturn.mockResolvedValue({ ...ok, cartId: 'cart-OTHER' });
    await get(`?orderId=${ID}`);
    expect(state.session.cartId).toBe('cart-1');
    expect(state.writes).toHaveLength(0);
  });
  it('second call returns the same location', async () => {
    resolveReturn.mockResolvedValue(ok);
    const first = await get(`?orderId=${ID}`);
    const second = await get(`?orderId=${ID}`);
    expect(second.headers.get('location')).toBe(first.headers.get('location'));
  });
  it('by order number as well', async () => {
    resolveReturn.mockResolvedValue(ok);
    await get('?orderNumber=MA-0123ABCD');
    expect(resolveReturn).toHaveBeenCalledWith({ orderId: undefined, orderNumber: 'MA-0123ABCD' }, expect.anything());
  });
  it('not-found and a thrown error answer the same plain 404', async () => {
    resolveReturn.mockResolvedValueOnce({ status: 'not-found' });
    const first = await get(`?orderId=${ID}`);
    resolveReturn.mockRejectedValueOnce(new Error('boom with secret'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const second = await get(`?orderId=${ID}`);
    spy.mockRestore();
    expect([first.status, second.status]).toEqual([404, 404]);
    expect(await first.text()).toBe(await second.text());
    expect(state.session.cartId).toBe('cart-1');
  });
  it('a return without an order (cancelled or expired) goes back to the checkout of the session store', async () => {
    const res = await get('');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/en-US/mau-reseller-north/checkout?status=cancelled');
    expect(resolveReturn).not.toHaveBeenCalled();
    expect(state.session.cartId).toBe('cart-1');
  });
  it('a return without an order and without a store is a 404', async () => {
    state.session = {};
    expect((await get('')).status).toBe(404);
  });
});
