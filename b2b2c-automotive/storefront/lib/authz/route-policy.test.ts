// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X-01 and attack group C (C16-C18, B-group entry points): every line of ROUTE_POLICY is run against the REAL route handler with
// synthetic personas, with the UI absent. Proof of a server-side refusal: the exact status AND commercetools (the SDK root and `fetch`)
// was never touched. The SDK is replaced by trap objects.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';
import { ROUTE_POLICY, type Access, type RouteMethod } from './route-policy';

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
  SESSION_COOKIE: 'malva_session',
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }),
  updateSession: async (patch: (s: object) => object) => patch(state.session),
  setSessionCookie: async () => undefined,
  clearSessionCookie: async () => undefined,
  createSessionToken: async () => 'token',
}));

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Module = Partial<Record<RouteMethod, Handler>>;
const modules = import.meta.glob<Module>('../../app/api/**/route.ts');

const fileOf = (pattern: string) => `../../app${pattern}/route.ts`;
const paramsOf = (pattern: string) => Object.fromEntries([...pattern.matchAll(/\[(?:\.\.\.)?(\w+)\]/g)].map((m) => [m[1], 'x']));
const MUTATING = new Set<RouteMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

const asAnonymous = (): Session => ({});
const asShopper = (storeKey: string, customerId = 'cust-a'): Session => ({ customerId, storeKey, distributionChannelId: `dist-${storeKey}`, supplyChannelId: `sup-${storeKey}`, productSelectionId: `sel-${storeKey}`, locale: 'en-US', currency: 'USD', country: 'US' });
const as = (session: Session) => {
  state.session = session as Record<string, unknown>;
};

// Some handlers validate the body before the session (a refusal either way, no data); a valid body makes the session check the first one.
const BODIES: Record<string, unknown> = {
  '/api/reviews': { productId: 'p1', rating: 5, title: 't', text: 'x' },
  '/api/auth/forgot-password': { email: 'a@example.com' },
};

function requestFor(pattern: string, method: RouteMethod): Request {
  const url = new URL(`http://localhost:3000${pattern.replace(/\[\.\.\.(\w+)\]/g, 'service/x').replace(/\[(\w+)\]/g, 'x')}`);
  const headers: Record<string, string> = { origin: 'http://localhost:3000', host: 'localhost:3000' };
  if (!MUTATING.has(method)) return new Request(url, { method, headers });
  return new Request(url, { method, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(BODIES[pattern] ?? {}) });
}

async function run(pattern: string, method: RouteMethod): Promise<Response> {
  const load = modules[fileOf(pattern)];
  if (!load) throw new Error(`no route module for ${pattern}`);
  const handler = (await load())[method];
  if (!handler) throw new Error(`${pattern} does not export ${method}`);
  return handler(requestFor(pattern, method), { params: Promise.resolve(paramsOf(pattern)) });
}

const cases = ROUTE_POLICY.flatMap((policy) => (Object.entries(policy.methods) as [RouteMethod, Access][]).map(([method, access]) => ({ policy, method, access })));
const label = (c: { policy: { pattern: string }; method: RouteMethod; access: Access }) => `${c.method} ${c.policy.pattern} [${c.access}]`;
const ofAccess = (access: Access) => cases.filter((c) => c.access === access);

beforeEach(() => {
  traps.touched = 0;
  vi.unstubAllEnvs();
  vi.stubEnv('REVIEW_SUBMISSION_ENABLED', 'true');
  vi.stubGlobal('fetch', vi.fn(async () => {
    traps.touched += 1;
    return Response.json({});
  }));
  as(asAnonymous());
});

describe('route policy completeness', () => {
  it('has a module for every policy line and a policy line for every module', () => {
    expect(ROUTE_POLICY.map((p) => fileOf(p.pattern)).sort()).toEqual(Object.keys(modules).sort());
  });
});

describe('C17 and C18: every account route refuses a visitor with no signed-in customer (401) and never calls commercetools', () => {
  it.each(ofAccess('customer').map((c) => [label(c), c] as const))('%s', async (_name, c) => {
    const res = await run(c.policy.pattern, c.method);
    expect(res.status).toBe(401);
    expect(traps.touched).toBe(0);
  });
  it('a visitor with a store session but no customer is refused the same way', async () => {
    as({ ...asShopper('store-a'), customerId: undefined });
    for (const c of ofAccess('customer')) {
      const res = await run(c.policy.pattern, c.method);
      expect(res.status, label(c)).toBe(401);
    }
    expect(traps.touched).toBe(0);
  });
});

describe('C21: the impersonated persona (a seller shopping as a customer)', () => {
  it('every non-GET account route is 403 impersonation-restricted and commercetools is not called', async () => {
    as({ ...asShopper('store-a'), impersonatedBy: 'seller-1', impJti: 'j', impAbs: 9e12, impImpExp: 9e12 });
    for (const c of ofAccess('customer').filter((x) => x.policy.pattern.startsWith('/api/account/') && MUTATING.has(x.method))) {
      const res = await run(c.policy.pattern, c.method);
      expect(res.status, label(c)).toBe(403);
      expect(await res.json(), label(c)).toMatchObject({ error: 'impersonation-restricted' });
    }
    expect(traps.touched).toBe(0);
  });
});

describe('cart routes: a visitor with no store session gets no cart and commercetools is not called', () => {
  it.each(ofAccess('cart').map((c) => [label(c), c] as const))('%s', async (_name, c) => {
    const res = await run(c.policy.pattern, c.method);
    expect([200, 400, 404, 409, 422, 503]).toContain(res.status); // 503: the hosted Checkout is not configured
    expect(traps.touched).toBe(0);
  });
});

describe('dev and demo routes are closed outside development', () => {
  it('the checkout completion helper is 404 in production and without its flag, with no commercetools call', async () => {
    as(asShopper('store-a'));
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CHECKOUT_DEV_COMPLETE', 'true');
    expect((await run('/api/dev/checkout/complete', 'POST')).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CHECKOUT_DEV_COMPLETE', '');
    expect((await run('/api/dev/checkout/complete', 'POST')).status).toBe(404);
    expect(traps.touched).toBe(0);
  });
  it('demo login routes answer 404 when DEMO_LOGIN_ENABLED is off, and the on-screen reset when DEMO_ONSCREEN_RESET is off', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', '');
    vi.stubEnv('DEMO_ONSCREEN_RESET', 'false');
    for (const [pattern, method] of [['/api/auth/demo-accounts', 'GET'], ['/api/auth/demo-login', 'POST'], ['/api/auth/reset-password', 'POST']] as const) {
      expect((await run(pattern, method)).status, `${method} ${pattern}`).toBe(404);
    }
    // The request for a link answers the same neutral 200 with no link (it must not reveal anything); no account is looked up.
    const forgot = await run('/api/auth/forgot-password', 'POST');
    expect(forgot.status).toBe(200);
    expect(await forgot.json()).toEqual({ ok: true });
    expect(traps.touched).toBe(0);
  });
  it('demo login stays closed in a production run even when the flag is set to true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
    expect((await run('/api/auth/demo-login', 'POST')).status).toBe(404);
    expect((await run('/api/auth/demo-accounts', 'GET')).status).toBe(404);
    expect(traps.touched).toBe(0);
  });
});

describe('token routes: no token is no session', () => {
  it('the shop-as hand-off with no token or a forged one is the generic 404 page and commercetools is not called', async () => {
    const res = await run('/api/impersonate', 'POST');
    expect(res.status).toBe(404);
    expect(traps.touched).toBe(0);
  });
});
