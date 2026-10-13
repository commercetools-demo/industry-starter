// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X-01 and attack group C (C01 to C03, C15, C18): every line of ROUTE_POLICY is run against the REAL route handler with
// synthetic personas (anonymous, Admin A, Buyer A, Admin B), with the UI absent. Proof of a server-side refusal: the exact status AND
// the commercetools clients (admin, frontend, provisioning) and `fetch` were never touched. The SDK is replaced by trap objects.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asUser, sellerState } from '@/test/seller-routes';
import { ACTION_ROLES, type PortalAction } from './permissions';
import { ROUTE_POLICY, type Access, type RouteMethod } from './route-policy';

const traps = vi.hoisted(() => ({ touched: 0 }));
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
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: trap() }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: trap(), projectKey: 'test-project', createApiRoot: () => trap() }));
vi.mock('@/lib/ct/provisioning-client', () => ({ getProvisioningRoot: () => trap() }));
vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => ({
  ...(await import('@/test/seller-routes')).associateModule(),
  asAssociate: () => trap(),
}));
vi.mock('@/lib/session', async () => {
  const { sellerState: state } = await import('@/test/seller-routes');
  return {
    SESSION_COOKIE: 'malva_portal_session',
    getSession: async () => state.session,
    getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }),
    updateSession: async (patch: (s: object) => object) => patch(state.session),
    setSessionCookie: async () => undefined,
    clearSessionCookie: async () => undefined,
    createSessionToken: async () => 'token',
  };
});

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Module = Partial<Record<RouteMethod, Handler>>;
const modules = import.meta.glob<Module>('../../app/api/**/route.ts');

const fileOf = (pattern: string) => `../../app${pattern}/route.ts`;
// `kind` is validated (404) before authorization, so give it a valid value; every other parameter is a placeholder.
const paramsOf = (pattern: string) => Object.fromEntries([...pattern.matchAll(/\[(?:\.\.\.)?(\w+)\]/g)].map((m) => [m[1], m[1] === 'kind' ? 'product' : 'x']));
const MUTATING = new Set<RouteMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

// Bodies of the public routes the gate tests below call (a valid body, so the gate itself is what answers).
const BODIES: Record<string, unknown> = { '/api/auth/demo-login': { customerId: 'c1' }, '/api/auth/reset-request': { email: 'a@example.com' }, '/api/auth/reset': { token: 'x'.repeat(32), password: 'Aa1!aaaaaaaa' } };

function requestFor(pattern: string, method: RouteMethod, multipart: boolean | undefined, storeKey: string): Request {
  const url = new URL(`http://localhost:3001${pattern.replace(/\[\.\.\.(\w+)\]/g, 'service/x').replace(/\[kind\]/g, 'product').replace(/\[(\w+)\]/g, 'x')}`);
  url.searchParams.set('storeKey', storeKey);
  url.searchParams.set('q', 'ab');
  const headers: Record<string, string> = { origin: 'http://localhost:3001', host: 'localhost:3001' };
  if (!MUTATING.has(method)) return new Request(url, { method, headers });
  if (multipart) {
    const form = new FormData();
    form.set('storeKey', storeKey);
    form.set('file', new Blob([new Uint8Array(32)], { type: 'image/png' }), 'x.png');
    return new Request(url, { method, headers, body: form });
  }
  return new Request(url, { method, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(BODIES[pattern] ?? { storeKey }) });
}

async function run(pattern: string, method: RouteMethod, multipart: boolean | undefined, storeKey = 'store-a'): Promise<Response> {
  const load = modules[fileOf(pattern)];
  if (!load) throw new Error(`no route module for ${pattern}`);
  const handler = (await load())[method];
  if (!handler) throw new Error(`${pattern} does not export ${method}`);
  return handler(requestFor(pattern, method, multipart, storeKey), { params: Promise.resolve(paramsOf(pattern)) });
}

const cases = ROUTE_POLICY.flatMap((policy) => (Object.entries(policy.methods) as [RouteMethod, Access][]).map(([method, access]) => ({ policy, method, access })));
const protectedCases = cases.filter((c) => c.access !== 'public');
const adminOnly = protectedCases.filter((c) => c.access !== 'session' && !(ACTION_ROLES[c.access as PortalAction] as readonly string[]).includes('buyer'));
const label = (c: { policy: { pattern: string }; method: RouteMethod; access: Access }) => `${c.method} ${c.policy.pattern} [${c.access}]`;

beforeEach(() => {
  traps.touched = 0;
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', vi.fn(async () => {
    traps.touched += 1;
    return Response.json({});
  }));
  asUser('adminA');
});

describe('route policy completeness', () => {
  it('has a module for every policy line and a policy line for every module', () => {
    const files = Object.keys(modules).sort();
    expect(ROUTE_POLICY.map((p) => fileOf(p.pattern)).sort()).toEqual(files);
  });
  it('a method is listed only with an access that exists', () => {
    for (const c of cases) expect(['public', 'session', ...Object.keys(ACTION_ROLES)], label(c)).toContain(c.access);
  });
});

describe('C18: every route that is not public refuses a request with no session (401) and never calls commercetools', () => {
  it.each(protectedCases.map((c) => [label(c), c] as const))('%s', async (_name, c) => {
    asUser('nobody');
    const res = await run(c.policy.pattern, c.method, c.policy.multipart);
    expect(res.status).toBe(401);
    expect(traps.touched).toBe(0);
  });
});

describe('C01 to C03: a Buyer on an Admin-only action is 403 before any commercetools call', () => {
  it.each(adminOnly.map((c) => [label(c), c] as const))('%s', async (_name, c) => {
    asUser('buyerA');
    const res = await run(c.policy.pattern, c.method, c.policy.multipart);
    expect(res.status).toBe(403);
    expect(traps.touched).toBe(0);
  });
});

describe('C15 and C12: a store key of another store in the query or body is 403 before any commercetools call (Admin of store B asking for store A)', () => {
  const storeScoped = protectedCases.filter((c) => c.access !== 'session' && !c.policy.pattern.startsWith('/api/contentools') && !c.policy.pattern.startsWith('/api/account') && !c.policy.pattern.startsWith('/api/company') && !c.policy.pattern.startsWith('/api/seller/dashboard') && c.policy.pattern !== '/api/store/preview-pages'); // these take the store from the session only
  it.each(storeScoped.map((c) => [label(c), c] as const))('%s', async (_name, c) => {
    asUser('adminB');
    const res = await run(c.policy.pattern, c.method, c.policy.multipart, 'store-a');
    expect(res.status).toBe(403);
    expect(traps.touched).toBe(0);
  });
});

describe('demo login and on-screen reset production gates', () => {
  it('demo login is 404 when the flag is off, and 404 in a production run even when the flag is true; no commercetools call', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', '');
    expect((await run('/api/auth/demo-login', 'POST', false)).status).toBe(404);
    expect((await run('/api/auth/demo-accounts', 'GET', false)).status).toBe(404);
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await run('/api/auth/demo-login', 'POST', false)).status).toBe(404);
    expect((await run('/api/auth/demo-accounts', 'GET', false)).status).toBe(404);
    expect(traps.touched).toBe(0);
  });
  it('the on-screen reset is 404 unless DEMO_ONSCREEN_RESET=true (the old spelling "on" no longer opens it); no commercetools call', async () => {
    vi.stubEnv('DEMO_ONSCREEN_RESET', '');
    expect((await run('/api/auth/reset-request', 'POST', false)).status).toBe(404);
    expect((await run('/api/auth/reset', 'POST', false)).status).toBe(404);
    vi.stubEnv('DEMO_ONSCREEN_RESET', 'on');
    expect((await run('/api/auth/reset-request', 'POST', false)).status).toBe(404);
    expect(traps.touched).toBe(0);
  });
});

describe('sessions of other personas', () => {
  it('the personas differ in role and store as the tests assume', () => {
    asUser('buyerA');
    expect(sellerState.roles).toEqual(['buyer']);
    asUser('adminB');
    expect(sellerState.session.storeKey).toBe('store-b');
  });
});
