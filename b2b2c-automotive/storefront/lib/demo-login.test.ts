// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ customers: vi.fn(), login: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { customers: () => ({ get: (arg: unknown) => ({ execute: async () => ({ body: await h.customers(arg) }) }) }) } }));
vi.mock('@/lib/auth/login', () => ({ loginCustomer: h.login, AuthError: class AuthError extends Error {} }));
vi.mock('@/lib/session', () => ({ getSession: h.session }));

import { GET as getAccounts } from '@/app/api/auth/demo-accounts/route';
import { POST as postLogin } from '@/app/api/auth/demo-login/route';
import { makeRequest } from '@/test/request';
import { demoSignIn, isDemoLoginEnabled, listDemoShoppers } from './demo-login';

const PASSWORD = 'demo-password-value';
const customer = (id: string, first: string, last: string, garage?: unknown) => ({
  id,
  email: `${first.toLowerCase()}@example.com`,
  firstName: first,
  lastName: last,
  custom: { fields: { isDemo: true, ...(garage ? { garage: JSON.stringify(garage) } : {}) } },
});
const anna = customer('c1', 'Anna', 'Schneider', { vehicles: [{ id: 'v1', make: 'Volkswagen', model: 'Golf', year: 2019, engine: '2.0 TDI' }], activeId: 'v1' });
const ben = customer('c2', 'Ben', 'Weber');

beforeEach(() => {
  process.env.DEMO_LOGIN_ENABLED = 'true';
  process.env.DEMO_LOGIN_PASSWORD = PASSWORD;
  (process.env as Record<string, string>).NODE_ENV = 'test';
  h.customers.mockReset().mockResolvedValue({ results: [anna, ben] });
  h.login.mockReset().mockResolvedValue({ customer: { id: 'c1' }, count: 3 });
  h.session.mockReset().mockResolvedValue({ storeKey: 'mau-reseller-north' });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.DEMO_LOGIN_ENABLED;
  delete process.env.DEMO_LOGIN_PASSWORD;
  vi.restoreAllMocks();
});

describe('demo login', () => {
  it('is enabled only with the flag and outside production', () => {
    expect(isDemoLoginEnabled({ DEMO_LOGIN_ENABLED: 'true', NODE_ENV: 'development' })).toBe(true);
    expect(isDemoLoginEnabled({ DEMO_LOGIN_ENABLED: 'true', NODE_ENV: 'production' })).toBe(false);
    expect(isDemoLoginEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isDemoLoginEnabled({ DEMO_LOGIN_ENABLED: '1', NODE_ENV: 'development' })).toBe(false);
  });

  it('disabled flag returns 404 from both routes', async () => {
    delete process.env.DEMO_LOGIN_ENABLED;
    expect((await getAccounts()).status).toBe(404);
    expect((await postLogin(makeRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({ customerId: 'c1' }) }))).status).toBe(404);
    expect(h.customers).not.toHaveBeenCalled();
    expect(h.login).not.toHaveBeenCalled();
  });

  it('list is scoped to the store and to demo customers', async () => {
    await listDemoShoppers('mau-reseller-north');
    const where = (h.customers.mock.calls[0][0] as { queryArgs: { where: string; sort: string } }).queryArgs;
    expect(where.where).toBe('stores(key="mau-reseller-north") and custom(fields(isDemo=true))');
    expect(where.sort).toBe('lastName asc');
  });

  it('labels read name and the active vehicle', async () => {
    expect(await listDemoShoppers('s1')).toEqual([
      { id: 'c1', label: 'Anna Schneider · Volkswagen Golf 2019' },
      { id: 'c2', label: 'Ben Weber' },
    ]);
  });

  it('list never contains email or password', async () => {
    const response = await getAccounts();
    const text = await response.text();
    expect(text).not.toContain('@example.com');
    expect(text).not.toContain(PASSWORD);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(JSON.parse(text)).toEqual({ accounts: [{ id: 'c1', label: 'Anna Schneider · Volkswagen Golf 2019' }, { id: 'c2', label: 'Ben Weber' }] });
  });

  it('unlisted customer id is refused with 403 and no session', async () => {
    const response = await postLogin(makeRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({ customerId: 'real-customer' }) }));
    expect(response.status).toBe(403);
    expect(h.login).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('demo login denied'));
  });

  it('listed id signs in through the shared login and merges the cart', async () => {
    const response = await postLogin(makeRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({ customerId: 'c1' }) }));
    expect(response.status).toBe(200);
    expect(h.login).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north', email: 'anna@example.com', password: PASSWORD });
    const body = await response.json();
    expect(body).toEqual({ customer: { id: 'c1' }, count: 3 });
    expect(JSON.stringify(body)).not.toContain(PASSWORD);
  });

  it('a missing password configuration is a 503 and never signs in', async () => {
    delete process.env.DEMO_LOGIN_PASSWORD;
    await expect(demoSignIn('c1', 's1')).rejects.toMatchObject({ status: 503 });
    expect(h.login).not.toHaveBeenCalled();
  });

  it('the store comes from the session, never from the body', async () => {
    await postLogin(makeRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({ customerId: 'c1', storeKey: 'mau-reseller-south' }) }));
    expect(h.login.mock.calls[0][0].storeKey).toBe('mau-reseller-north');
  });

  it('a bad body is 400', async () => {
    expect((await postLogin(makeRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({}) }))).status).toBe(400);
  });
});
