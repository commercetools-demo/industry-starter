// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOrderAccessToken } from '@/lib/order-access';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session }));
const getOrder = vi.hoisted(() => vi.fn());
const claimOrder = vi.hoisted(() => vi.fn());
const createCustomer = vi.hoisted(() => vi.fn());
const deleteCustomer = vi.hoisted(() => vi.fn());
const loginCustomer = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/orders', () => ({ getOrderForConfirmation: getOrder, claimOrder }));
vi.mock('@/lib/ct/customers', () => ({
  createStoreCustomer: createCustomer,
  deleteCustomer,
  DuplicateCustomerError: class DuplicateCustomerError extends Error {},
}));
vi.mock('@/lib/auth/login', () => ({ loginCustomer, clientKey: (r: Request) => r.headers.get('x-forwarded-for') ?? 'unknown' }));

const STORE = 'mau-reseller-north';
const NUMBER = 'MA-0123ABCD';
const order = (extra: Record<string, unknown> = {}) => ({
  id: 'o-1',
  version: 2,
  orderNumber: NUMBER,
  customerEmail: 'qa-p1@example.com',
  anonymousId: 'anon-1',
  store: { key: STORE },
  shippingAddress: { firstName: 'Ada', lastName: 'Test', country: 'DE' },
  ...extra,
});
const call = async (body: unknown, headers: Record<string, string> = {}, number = NUMBER) => {
  const { POST } = await import('./route');
  const request = makeRequest(`/api/orders/${number}/claim`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return POST(request, { params: Promise.resolve({ orderNumber: number }) });
};
const good = { store: STORE, password: 'correct horse battery' };

beforeEach(() => {
  vi.resetModules();
  for (const m of [getOrder, claimOrder, createCustomer, deleteCustomer, loginCustomer]) m.mockReset();
  state.session = { storeKey: STORE, anonymousId: 'anon-1' };
  getOrder.mockResolvedValue(order());
  createCustomer.mockResolvedValue({ id: 'c-1', version: 1, email: 'qa-p1@example.com' });
  claimOrder.mockResolvedValue(undefined);
  loginCustomer.mockResolvedValue({ customer: { id: 'c-1' }, count: 0 });
});

describe('POST /api/orders/[orderNumber]/claim', () => {
  it('creates customer in the order store and attaches order', async () => {
    const res = await call(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getOrder).toHaveBeenCalledWith(STORE, NUMBER);
    expect(createCustomer).toHaveBeenCalledWith(STORE, { email: 'qa-p1@example.com', password: good.password, firstName: 'Ada', lastName: 'Test' });
    expect(claimOrder).toHaveBeenCalledWith(STORE, 'o-1', 'c-1');
  });
  it('only a password is required', async () => {
    expect((await call({ store: STORE, password: 'correct horse battery' })).status).toBe(200);
    expect((await call({ store: STORE })).status).toBe(400);
  });
  it('the email is the order email, never taken from the request', async () => {
    await call({ ...good, email: 'someone-else@example.com' });
    expect(createCustomer.mock.calls[0][1].email).toBe('qa-p1@example.com');
  });
  it('weak password names the rule', async () => {
    const short = await call({ ...good, password: 'short' });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: 'password', rule: 'too-short' });
    const common = await call({ ...good, password: 'password123' });
    expect(await common.json()).toMatchObject({ error: 'password', rule: 'too-common' });
    expect(createCustomer).not.toHaveBeenCalled();
  });
  it('order with a customer is refused generically', async () => {
    getOrder.mockResolvedValue(order({ customerId: 'c-9' }));
    state.session = { storeKey: STORE, customerId: 'c-9' };
    const res = await call(good);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'account-failed' });
    expect(createCustomer).not.toHaveBeenCalled();
  });
  it('stranger without token is refused', async () => {
    state.session = { storeKey: STORE, anonymousId: 'someone-else' };
    const res = await call(good);
    expect(res.status).toBe(404);
    expect(createCustomer).not.toHaveBeenCalled();
  });
  it('unknown order gives the same 404 as a stranger', async () => {
    const stranger = await (async () => {
      state.session = { storeKey: STORE, anonymousId: 'someone-else' };
      return call(good);
    })();
    getOrder.mockResolvedValue(null);
    const unknown = await call(good);
    expect(unknown.status).toBe(stranger.status);
    expect(await unknown.json()).toEqual(await stranger.clone().json());
  });
  it('token holder in another browser may create the account', async () => {
    state.session = { storeKey: STORE, anonymousId: 'another-browser' };
    const token = await signOrderAccessToken({ orderId: 'o-1', storeKey: STORE });
    expect((await call({ ...good, token })).status).toBe(200);
    const wrong = await signOrderAccessToken({ orderId: 'o-2', storeKey: STORE });
    expect((await call({ ...good, token: wrong })).status).toBe(404);
  });
  it('duplicate email gives generic message and creates nothing', async () => {
    const { DuplicateCustomerError } = await import('@/lib/ct/customers');
    createCustomer.mockRejectedValue(new DuplicateCustomerError());
    const res = await call(good);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'account-failed' });
    expect(claimOrder).not.toHaveBeenCalled();
    expect(loginCustomer).not.toHaveBeenCalled();
  });
  it('claim failure deletes the new customer', async () => {
    claimOrder.mockRejectedValue({ statusCode: 500 });
    const res = await call(good);
    expect(res.status).toBe(500);
    expect(deleteCustomer).toHaveBeenCalledWith(STORE, 'c-1', 1);
    expect(loginCustomer).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).not.toMatch(/c-1|customer/i);
  });
  it('signs the shopper in and sets session', async () => {
    await call(good);
    expect(loginCustomer).toHaveBeenCalledWith({ storeKey: STORE, email: 'qa-p1@example.com', password: good.password });
  });
  it('rate limited', async () => {
    for (let i = 0; i < 10; i += 1) await call({ ...good, password: 'short' }, { 'x-forwarded-for': '10.0.0.9' });
    const res = await call(good, { 'x-forwarded-for': '10.0.0.9' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('900');
  });
  it('answers are never cached', async () => {
    expect((await call(good)).headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('a malformed order number is a 404 without a read', async () => {
    const res = await call(good, {}, 'AL-48213');
    expect(res.status).toBe(404);
  });
});
