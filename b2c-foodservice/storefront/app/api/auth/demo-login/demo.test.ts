// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/auth', () => ({ signIn: ct.signIn, getCustomerById: vi.fn() }));

import { GET as listRoute } from '@/app/api/auth/demo-customers/route';
import { POST as demoLogin } from '@/app/api/auth/demo-login/route';
import { DEMO_CUSTOMERS } from '@/lib/auth/demo-customers';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const PASSWORD = 'demo-pass-for-tests-1';
const post = (body: unknown, ip = '5.5.5.1') =>
  demoLogin(new Request('http://x/api/auth/demo-login', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } }), ctx);
const list = () => listRoute(new Request('http://x/api/auth/demo-customers'), ctx);

beforeEach(() => {
  jar.store.clear();
  resetRateLimits();
  ct.signIn.mockReset().mockImplementation(async (email: string) => ({
    customer: { id: 'cust-demo', email, firstName: 'Maya', lastName: 'Okonkwo', addresses: [] },
    cart: { id: 'cart-m', lineItems: [{ quantity: 3 }] },
  }));
  vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
  vi.stubEnv('DEMO_LOGIN_PASSWORD', PASSWORD);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('demo sign-in (D-040)', () => {
  it('Demo list has names and markets but no email or password', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    const text = await res.text();
    const { customers } = JSON.parse(text);
    expect(customers).toHaveLength(DEMO_CUSTOMERS.length);
    expect(customers[0]).toEqual({ key: 'mcf-customer-maya', name: 'Maya Okonkwo', market: 'US' });
    expect(text).not.toMatch(/@|example\.com|demo-pass/);
  });

  it('the demo list equals the seed customers', () => {
    const seed = readFileSync(join(process.cwd(), '..', 'seed', 'src', 'data', 'customers.ts'), 'utf8');
    const rows = [...seed.matchAll(/key: '([^']+)', email: '([^']+)', firstName: '([^']+)', lastName: '([^']+)', country: '(US|CA)'/g)].map(
      (m) => ({ key: m[1], email: m[2], firstName: m[3], lastName: m[4], country: m[5] }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect([...DEMO_CUSTOMERS]).toEqual(rows);
  });

  it('Demo login signs in the chosen customer and merges the cart', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ cartId: 'cart-m', anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' }));
    const res = await post({ key: 'mcf-customer-maya' });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(JSON.parse(body).cart).toEqual({ id: 'cart-m', lineCount: 1, quantity: 3 });
    expect(ct.signIn).toHaveBeenCalledWith('maya.okonkwo@example.com', PASSWORD, { cartId: 'cart-m', anonymousId: 'anon-1' });
    const session = await verifySessionToken(new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(res.headers.get('set-cookie') ?? '')?.[1]);
    expect(session).toMatchObject({ customerId: 'cust-demo', cartId: 'cart-m', country: 'US' });
    expect(body).not.toContain(PASSWORD);
  });

  it('Demo login returns 404 when disabled', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'false');
    expect((await post({ key: 'mcf-customer-maya' })).status).toBe(404);
    expect((await list()).status).toBe(404);
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
    vi.stubEnv('DEMO_LOGIN_PASSWORD', '');
    expect((await post({ key: 'mcf-customer-maya' })).status).toBe(404);
    expect(ct.signIn).not.toHaveBeenCalled();
  });

  it('Unknown demo key is refused', async () => {
    for (const body of [{ key: 'mcf-customer-nobody' }, { key: 5 }, {}, { key: 'maya.okonkwo@example.com' }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('invalid_request');
    }
    expect(ct.signIn).not.toHaveBeenCalled();
  });

  it('Demo sign-in is rate limited like login', async () => {
    for (let i = 0; i < 5; i++) expect((await post({ key: 'mcf-customer-liam' })).status).toBe(200);
    const limited = await post({ key: 'mcf-customer-liam' });
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.retryAfterSeconds).toBeGreaterThan(0);
    expect((await post({ key: 'mcf-customer-liam' }, '5.5.5.2')).status).toBe(200);
  });

  it('a failed demo sign-in logs neither the email nor the password', async () => {
    const spy = vi.spyOn(console, 'error');
    ct.signIn.mockRejectedValueOnce({ statusCode: 503 });
    await post({ key: 'mcf-customer-maya' });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/example\.com|demo-pass/);
  });
});
