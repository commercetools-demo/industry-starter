// @vitest-environment node
import { decodeJwt } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ signIn: vi.fn(), getCustomerById: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/auth', () => ({ signIn: ct.signIn, getCustomerById: ct.getCustomerById }));

import { GET as me } from '@/app/api/auth/me/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type Session } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const customer = { id: 'cust-1', email: 'qa@example.com', firstName: 'Qa', lastName: 'Tester', addresses: [] };
const post = (handler: typeof login, body: unknown, ip = '9.9.9.1') =>
  handler(
    new Request('http://x/api/auth/login', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } }),
    ctx,
  );

async function seed(session: Session) {
  jar.store.set(SESSION_COOKIE, await createSessionToken(session));
}
function cookieOf(res: Response): string | undefined {
  return new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(res.headers.get('set-cookie') ?? '')?.[1];
}
const written = (res: Response) => verifySessionToken(cookieOf(res));

beforeEach(() => {
  jar.store.clear();
  resetRateLimits();
  ct.signIn.mockReset();
  ct.getCustomerById.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('POST /api/auth/login', () => {
  it('Credentials accepted', async () => {
    ct.signIn.mockResolvedValue({ customer, cart: { id: 'cart-9', lineItems: [{ quantity: 2 }] } });
    const res = await post(login, { email: ' qa@example.com ', password: 'pw-long-enough1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer).toMatchObject({ id: 'cust-1', email: 'qa@example.com' });
    expect(body.cart).toEqual({ id: 'cart-9', lineCount: 1, quantity: 2 });
    expect(await written(res)).toMatchObject({ customerId: 'cust-1', customerFirstName: 'Qa', cartId: 'cart-9' });
    expect(ct.signIn.mock.calls[0][0]).toBe('qa@example.com');
  });

  it('missing fields are an invalid request', async () => {
    const res = await post(login, { email: 'qa@example.com' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  it('Unknown and wrong are indistinguishable', async () => {
    ct.signIn.mockRejectedValueOnce({ statusCode: 400, errors: [{ code: 'InvalidCredentials' }] });
    const wrong = await post(login, { email: 'qa@example.com', password: 'x' });
    ct.signIn.mockRejectedValueOnce({ statusCode: 404, message: 'customer does not exist' });
    const unknown = await post(login, { email: 'nobody@example.com', password: 'x' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(wrong.status);
    expect(await unknown.text()).toBe(await wrong.text());
    expect(wrong.headers.get('set-cookie')).toBeNull();
  });

  it('an upstream outage is not reported as bad credentials', async () => {
    ct.signIn.mockRejectedValueOnce({ statusCode: 503 });
    const res = await post(login, { email: 'qa@example.com', password: 'x' });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('upstream_unavailable');
  });

  it('Sign in carries the anonymous cart', async () => {
    ct.signIn.mockResolvedValue({ customer, cart: { id: 'cart-1', lineItems: [] } });
    await seed({ cartId: 'cart-1', anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' });
    const res = await post(login, { email: 'qa@example.com', password: 'pw' });
    expect(ct.signIn).toHaveBeenCalledWith('qa@example.com', 'pw', { cartId: 'cart-1', anonymousId: 'anon-1' });
    const session = await written(res);
    expect(session.anonymousId).toBeUndefined();
    expect(session).toMatchObject({ cartId: 'cart-1', country: 'US' });
  });

  it('the session keeps its cart when the result carries none', async () => {
    ct.signIn.mockResolvedValue({ customer });
    await seed({ cartId: 'cart-keep' });
    expect((await written(await post(login, { email: 'qa@example.com', password: 'pw' }))).cartId).toBe('cart-keep');
  });

  it('Login issues a fresh cookie', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T10:00:00Z'));
    await seed({ country: 'US' });
    const before = jar.store.get(SESSION_COOKIE) as string;
    vi.setSystemTime(new Date('2026-10-21T10:05:00Z'));
    ct.signIn.mockResolvedValue({ customer });
    const res = await post(login, { email: 'qa@example.com', password: 'pw' });
    const after = cookieOf(res) as string;
    expect(after).not.toBe(before);
    expect((decodeJwt(after).iat ?? 0) - (decodeJwt(before).iat ?? 0)).toBe(300);
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  });

  it('Login is rate limited and still ambiguous', async () => {
    ct.signIn.mockRejectedValue({ statusCode: 400 });
    const bodies = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await post(login, { email: 'qa@example.com', password: `x${i}` });
      expect(res.status).toBe(401);
      bodies.add(await res.text());
    }
    expect(bodies.size).toBe(1);
    const limited = await post(login, { email: 'qa@example.com', password: 'x' });
    expect(limited.status).toBe(429);
    const { error } = await limited.json();
    expect(error.code).toBe('too_many_attempts');
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    // another address from the same ip is still answered
    expect((await post(login, { email: 'other@example.com', password: 'x' })).status).toBe(401);
    expect(ct.signIn).toHaveBeenCalledTimes(6);
  });

  it('nothing sensitive is logged', async () => {
    const spy = vi.spyOn(console, 'error');
    ct.signIn.mockRejectedValueOnce({ statusCode: 503 });
    await post(login, { email: 'qa@example.com', password: 'secret-pw-123' });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/secret-pw-123|qa@example\.com/);
  });
});

describe('POST /api/auth/logout', () => {
  it('Logout keeps market and store', async () => {
    await seed({
      customerId: 'c1', customerEmail: 'e', customerFirstName: 'f', customerLastName: 'l', cartId: 'cart', anonymousId: 'a',
      country: 'CA', currency: 'CAD', locale: 'en-CA', collectionStoreKey: 'mcf-store-a',
    });
    const res = await logout(new Request('http://x/api/auth/logout', { method: 'POST' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await written(res)).toEqual({ country: 'CA', currency: 'CAD', locale: 'en-CA', collectionStoreKey: 'mcf-store-a' });
  });

  it('is idempotent without a session', async () => {
    const res = await logout(new Request('http://x/api/auth/logout', { method: 'POST' }), ctx);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  const get = () => me(new Request('http://x/api/auth/me'), ctx);

  it('me returns null not 401', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customer: null });
    await seed({ customerId: 'c1' });
    ct.getCustomerById.mockRejectedValue({ statusCode: 404 });
    const failed = await get();
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual({ customer: null });
  });

  it('returns the customer for a signed-in session', async () => {
    await seed({ customerId: 'cust-1' });
    ct.getCustomerById.mockResolvedValue(customer);
    expect((await (await get()).json()).customer).toMatchObject({ id: 'cust-1', firstName: 'Qa' });
  });

  it('Tampered cookie is an empty session', async () => {
    await seed({ customerId: 'cust-1' });
    jar.store.set(SESSION_COOKIE, `${jar.store.get(SESSION_COOKIE)}x`);
    const res = await get();
    expect(await res.json()).toEqual({ customer: null });
    expect(ct.getCustomerById).not.toHaveBeenCalled();
  });
});
