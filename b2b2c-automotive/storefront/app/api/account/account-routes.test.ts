// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const h = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  customer: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    changeEmail: vi.fn(),
    anonymise: vi.fn(),
  },
  addresses: { list: vi.fn(), add: vi.fn(), change: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
  subs: { list: vi.fn(), run: vi.fn(), offered: vi.fn() },
  methods: { list: vi.fn(), del: vi.fn() },
  orders: { request: vi.fn() },
  policies: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: async () => h.session,
  getLocale: async () => ({ locale: 'en-US', currency: 'EUR', country: 'DE' }),
  updateSession: async (patch: (s: Record<string, unknown>) => Record<string, unknown>) => (h.session = patch(h.session)),
}));
vi.mock('@/lib/ct/account-customer', () => ({ getProfile: h.customer.getProfile, updateProfile: h.customer.updateProfile, changePassword: h.customer.changePassword, changeEmail: h.customer.changeEmail, anonymiseCustomer: h.customer.anonymise }));
vi.mock('@/lib/ct/account-addresses', () => ({ listAddresses: h.addresses.list, addAddress: h.addresses.add, changeAddress: h.addresses.change, removeAddress: h.addresses.remove, setDefaultAddress: h.addresses.setDefault }));
vi.mock('@/lib/ct/account-subscriptions', () => ({ listSubscriptions: h.subs.list, runSubscriptionAction: h.subs.run, subscriptionsOffered: h.subs.offered }));
vi.mock('@/lib/ct/account-payment-methods', () => ({ listPaymentMethods: h.methods.list, deletePaymentMethod: h.methods.del }));
vi.mock('@/lib/ct/account-orders', () => ({ requestReturn: h.orders.request, getAccountOrder: vi.fn() }));
vi.mock('@/lib/ct/recurrence-policies', () => ({ listRecurrencePolicies: h.policies }));
vi.mock('@/lib/ct/stores', () => ({ getStoreContext: async () => ({ countries: ['DE'] }) }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext: async () => ({ settings: { returnWindowDays: 14 }, branches: [], retailChannelId: 'r' }) }));
vi.mock('@/lib/auth/login', () => ({ clientKey: (r: Request) => r.headers.get('x-forwarded-for') ?? 'unknown' }));

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const req = (path: string, method: string, body?: unknown, ip = '5.5.5.5') => makeRequest(path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const ctx = <T extends object>(params: T) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  vi.resetModules();
  h.session = { storeKey: 'mau-reseller-north', customerId: CUSTOMER, anonymousId: 'anon', cartId: 'cart' };
  for (const group of [h.customer, h.addresses, h.subs, h.methods, h.orders]) for (const fn of Object.values(group)) fn.mockReset();
  h.policies.mockReset().mockResolvedValue([]);
});

describe('account routes need a signed-in shopper', () => {
  it('answer 401 without a customer in the session', async () => {
    h.session = { storeKey: 'mau-reseller-north' };
    const calls: Array<Promise<Response>> = [];
    calls.push((await import('./profile/route')).GET());
    calls.push((await import('./addresses/route')).GET());
    calls.push((await import('./subscriptions/route')).GET());
    calls.push((await import('./payment-methods/route')).GET());
    calls.push((await import('./subscriptions/[id]/route')).PUT(req('/x', 'PUT', { action: 'pause' }), ctx({ id: 'a' })));
    calls.push((await import('./orders/[orderNumber]/return/route')).POST(req('/x', 'POST', { items: [], reason: 'x' }), ctx({ orderNumber: 'MA-1' })));
    calls.push((await import('./delete/route')).POST(req('/x', 'POST', { password: 'a', confirm: 'DELETE' })));
    for (const response of await Promise.all(calls)) expect(response.status).toBe(401);
    expect(h.customer.getProfile).not.toHaveBeenCalled();
    expect(h.subs.run).not.toHaveBeenCalled();
  });
});

describe('profile', () => {
  it('reads and writes with the session customer, never one from the request', async () => {
    h.customer.updateProfile.mockResolvedValue({ firstName: 'A' });
    const { PUT } = await import('./profile/route');
    const res = await PUT(req('/api/account/profile', 'PUT', { firstName: 'A', customerId: 'someone-else' }));
    expect(res.status).toBe(200);
    expect(h.customer.updateProfile).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, { firstName: 'A' });
  });
  it('400 for a mobile number with letters', async () => {
    const { PUT } = await import('./profile/route');
    expect((await PUT(req('/api/account/profile', 'PUT', { mobile: 'call me' }))).status).toBe(400);
  });
});

describe('password and email', () => {
  it('a wrong current password is one message', async () => {
    const { AccountError } = await import('@/lib/account/errors');
    h.customer.changePassword.mockRejectedValue(new AccountError('wrong-password'));
    const { POST } = await import('./password/route');
    const res = await POST(req('/api/account/password', 'POST', { currentPassword: 'x', newPassword: 'correct horse battery' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'wrong-password' });
  });
  it('email change calls changeEmail for the session customer', async () => {
    h.customer.changeEmail.mockResolvedValue({ email: 'new@example.com' });
    const { POST } = await import('./email/route');
    const res = await POST(req('/api/account/email', 'POST', { newEmail: 'new@example.com', currentPassword: 'pw' }));
    expect(res.status).toBe(200);
    expect(h.customer.changeEmail).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, { newEmail: 'new@example.com', currentPassword: 'pw' });
  });
});

describe('delete account', () => {
  it('needs the typed word', async () => {
    const { POST } = await import('./delete/route');
    const res = await POST(req('/api/account/delete', 'POST', { password: 'pw', confirm: 'nope' }));
    expect(res.status).toBe(400);
    expect(h.customer.anonymise).not.toHaveBeenCalled();
  });
  it('delete route signs out', async () => {
    h.customer.anonymise.mockResolvedValue(undefined);
    const { POST } = await import('./delete/route');
    const res = await POST(req('/api/account/delete', 'POST', { password: 'pw', confirm: 'löschen' }));
    expect(res.status).toBe(200);
    expect(h.customer.anonymise).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, 'pw');
    expect(h.session.customerId).toBeUndefined();
    expect(h.session.cartId).toBeUndefined();
    expect(h.session.anonymousId).not.toBe('anon');
  });
  it('a wrong password does not sign out', async () => {
    const { AccountError } = await import('@/lib/account/errors');
    h.customer.anonymise.mockRejectedValue(new AccountError('wrong-password'));
    const { POST } = await import('./delete/route');
    const res = await POST(req('/api/account/delete', 'POST', { password: 'bad', confirm: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(h.session.customerId).toBe(CUSTOMER);
  });
});

describe('addresses, payment methods, subscriptions, returns', () => {
  it('address add uses the store countries', async () => {
    h.addresses.add.mockResolvedValue({ addresses: [], defaultShippingAddressId: null });
    const { POST } = await import('./addresses/route');
    const address = { firstName: 'A', lastName: 'B', streetName: 'S', postalCode: '10115', city: 'Berlin', country: 'DE' };
    expect((await POST(req('/api/account/addresses', 'POST', address))).status).toBe(200);
    expect(h.addresses.add).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, address, ['DE']);
  });
  it('address default and delete go to the session customer', async () => {
    h.addresses.setDefault.mockResolvedValue({ addresses: [] });
    h.addresses.remove.mockResolvedValue({ addresses: [] });
    const route = await import('./addresses/[id]/route');
    const patched = await route.PATCH(req('/x', 'PATCH'), ctx({ id: 'a2' }));
    const deleted = await route.DELETE(req('/x', 'DELETE'), ctx({ id: 'a1' }));
    // Every write returns the store's countries too, or the form loses its country list (regression found in the browser run).
    expect((await patched.json()).countries).toEqual(['DE']);
    expect((await deleted.json()).countries).toEqual(['DE']);
    expect(h.addresses.setDefault).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, 'a2');
    expect(h.addresses.remove).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, 'a1');
  });
  it('payment method delete passes the session customer', async () => {
    h.methods.del.mockResolvedValue(undefined);
    const { DELETE } = await import('./payment-methods/[id]/route');
    expect((await DELETE(req('/x', 'DELETE'), ctx({ id: 'pm1' }))).status).toBe(200);
    expect(h.methods.del).toHaveBeenCalledWith(CUSTOMER, 'pm1');
  });
  it('subscriptions list says whether the menu item is offered', async () => {
    h.subs.offered.mockResolvedValue(false);
    h.subs.list.mockResolvedValue([]);
    const { GET } = await import('./subscriptions/route');
    expect(await (await GET()).json()).toEqual({ offered: false, subscriptions: [], policies: [] });
    h.subs.list.mockResolvedValue([{ id: 'ro1' }]);
    expect((await (await GET()).json()).offered).toBe(true);
  });
  it('a subscription action validates the body and returns the API state', async () => {
    h.subs.run.mockResolvedValue({ id: 'ro1', nextOrderAt: '2027-01-01T00:00:00Z' });
    const { PUT } = await import('./subscriptions/[id]/route');
    expect((await PUT(req('/x', 'PUT', { action: 'explode' }), ctx({ id: 'ro1' }))).status).toBe(400);
    expect((await PUT(req('/x', 'PUT', { action: 'change-frequency' }), ctx({ id: 'ro1' }))).status).toBe(400);
    const ok = await PUT(req('/x', 'PUT', { action: 'change-frequency', policyKey: 'mau-rp-monthly' }), ctx({ id: 'ro1' }));
    expect(ok.status).toBe(200);
    expect(h.subs.run).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, 'ro1', { action: 'change-frequency', policyKey: 'mau-rp-monthly' }, 'en-US');
  });
  it('return passes the store window and the session customer', async () => {
    h.orders.request.mockResolvedValue({ returnNumber: 'RET-MA-1-1', tracking: 'RT-1' });
    const { POST } = await import('./orders/[orderNumber]/return/route');
    const body = { items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'wrong-fit' };
    const res = await POST(req('/x', 'POST', body), ctx({ orderNumber: 'MA-ABCD2345' }));
    expect(await res.json()).toEqual({ returnNumber: 'RET-MA-1-1', tracking: 'RT-1' });
    expect(h.orders.request).toHaveBeenCalledWith('mau-reseller-north', CUSTOMER, 'MA-ABCD2345', body, { windowDays: 14, locale: 'en-US' });
  });
});
