// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Attack C21 and Q-V25 (workstream X): while a seller shops as a customer (`session.impersonatedBy`) the account area refuses every write with
// 403 `impersonation-restricted` (commercetools never touched) and the three personal GET routes answer no e-mail, phone, address or card data.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_POLICY, type RouteMethod } from '@/lib/authz/route-policy';

const traps = vi.hoisted(() => ({ touched: 0 }));
const state = vi.hoisted(() => ({ session: {} as Record<string, unknown> }));
const trap = (): unknown => {
  const fn = () => undefined;
  return new Proxy(fn, {
    get: (_t, key) => {
      if (key === 'then') return undefined;
      traps.touched += 1;
      return trap();
    },
    apply: () => {
      traps.touched += 1;
      throw new Error('commercetools was called');
    },
  });
};
vi.mock('@/lib/ct/client', () => ({ apiRoot: trap(), projectKey: 'test-project', createApiRoot: () => trap() }));
vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }),
}));
vi.mock('@/lib/ct/account-customer', () => ({
  getProfile: async () => ({ id: 'c1', firstName: 'Anna', lastName: 'Beispiel', email: 'anna.beispiel@example.de', mobile: '+49 170 1234567', marketingConsent: true }),
}));
vi.mock('@/lib/ct/account-addresses', () => ({
  listAddresses: async () => ({ addresses: [{ id: 'a1', city: 'Berlin' }], defaultShippingAddressId: 'a1' }),
}));
vi.mock('@/lib/ct/stores', () => ({ getStoreContext: async () => ({ countries: ['DE'] }) }));
vi.mock('@/lib/ct/account-payment-methods', () => ({ listPaymentMethods: async () => [{ id: 'pm1', label: 'Visa', last4: '4242' }] }));
vi.mock('@/lib/ct/account-subscriptions', () => ({ listSubscriptions: async () => [{ id: 's1', status: 'active' }] }));

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
const modules = import.meta.glob<Partial<Record<RouteMethod, Handler>>>('../../app/api/account/**/route.ts');
const MUTATING = new Set<RouteMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

const impersonated = { customerId: 'cust-a', storeKey: 'store-a', impersonatedBy: 'seller-1', impJti: 'j', impAbs: 9e12, impImpExp: 9e12 };
const normal = { customerId: 'cust-a', storeKey: 'store-a' };

async function run(pattern: string, method: RouteMethod): Promise<Response> {
  const load = modules[`../../app${pattern}/route.ts`];
  if (!load) throw new Error(`no route ${pattern}`);
  const handler = (await load())[method];
  if (!handler) throw new Error(`${pattern} has no ${method}`);
  const url = `http://localhost:3000${pattern.replace(/\[(\w+)\]/g, 'x')}`;
  const request = MUTATING.has(method)
    ? new Request(url, { method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{}' })
    : new Request(url, { method });
  return handler(request, { params: Promise.resolve({ id: 'x', orderNumber: 'x' }) });
}

const accountCases = ROUTE_POLICY.filter((p) => p.pattern.startsWith('/api/account/')).flatMap((p) => (Object.keys(p.methods) as RouteMethod[]).map((method) => ({ pattern: p.pattern, method })));

beforeEach(() => {
  traps.touched = 0;
  state.session = impersonated;
});

describe('C21: a shop-as session cannot change the account', () => {
  const writes = accountCases.filter((c) => MUTATING.has(c.method));
  it('covers every write route of the account area', () => expect(writes.length).toBeGreaterThanOrEqual(9));
  it.each(writes.map((c) => [`${c.method} ${c.pattern}`, c] as const))('%s answers 403 impersonation-restricted with no commercetools call', async (_name, c) => {
    const res = await run(c.pattern, c.method);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'impersonation-restricted' });
    expect(traps.touched).toBe(0);
  });
  it('a normal customer session is not refused by the guard (the handler runs)', async () => {
    state.session = normal;
    const res = await run('/api/account/password', 'POST');
    expect(res.status).not.toBe(403);
  });
});

describe('C21: a shop-as session reads no personal data', () => {
  it('GET profile masks the e-mail and drops phone and addresses', async () => {
    const res = await run('/api/account/profile', 'GET');
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('anna.beispiel@example.de');
    expect(text).not.toContain('1234567');
    expect(text).toContain('a***@e***.de');
  });
  it('GET addresses answers an empty list and no default', async () => {
    const body = (await (await run('/api/account/addresses', 'GET')).json()) as { addresses: unknown[]; defaultShippingAddressId: unknown };
    expect(body.addresses).toEqual([]);
    expect(body.defaultShippingAddressId ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toContain('Berlin');
  });
  it('GET payment-methods answers an empty list', async () => {
    const body = (await (await run('/api/account/payment-methods', 'GET')).json()) as { methods: unknown[] };
    expect(body.methods).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('4242');
  });
  it('a normal customer still reads their own data', async () => {
    state.session = normal;
    const text = JSON.stringify(await (await run('/api/account/profile', 'GET')).json());
    expect(text).toContain('anna.beispiel@example.de');
    const methods = (await (await run('/api/account/payment-methods', 'GET')).json()) as { methods: unknown[] };
    expect(methods.methods).toHaveLength(1);
  });
});
