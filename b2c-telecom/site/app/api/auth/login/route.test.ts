// @vitest-environment node
import type { Cart } from '@/lib/types';
import { apiRoot, authRequest, ctCustomer, failure, resetWorld, sameIp, sessionMock, world } from '@/test/fixtures/authWorld';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => apiRoot }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/authWorld')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
const padResponse = vi.fn<(startedAt: number) => Promise<void>>(async () => undefined);
vi.mock('@/lib/auth/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/auth/api')>()), padResponse: (startedAt: number) => padResponse(startedAt) }));
const readBundle = vi.fn();
vi.mock('@/lib/ct/bundle', () => ({ readBundle: (...args: unknown[]) => readBundle(...args) }));

import { resetLockoutsForTests } from '@/lib/auth/rate-limit';
import { POST } from './route';

void sessionMock;

const mergedCart = (patch: Partial<Cart> = {}): Cart => ({ id: 'cart-9', itemCount: 1, issues: [], lines: [], ...patch }) as unknown as Cart;
const login = (body: unknown, headers: Record<string, string> = {}) => POST(authRequest('/api/auth/login', body, headers));
const valid = { email: 'jane@example.com', password: 'Aa1-valid-pass' };

beforeEach(() => {
  resetWorld({ anonymousId: 'anon-1', cartId: 'cart-1' });
  resetLockoutsForTests();
  padResponse.mockClear();
  readBundle.mockReset();
  readBundle.mockResolvedValue({ cart: mergedCart(), cartId: 'cart-9' });
  world.handler = () => ({ customer: ctCustomer(), cart: { id: 'cart-9' } });
});

describe('POST /api/auth/login', () => {
  it('Credentials accepted: issues a session for the customer and returns the merged cart', async () => {
    const res = await login(valid);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.user).toEqual({ id: 'c-1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', customerNumber: 'MV-12345-5', isEmailVerified: true, createdAt: '2026-10-07T10:00:00.000Z' });
    expect(body.cart).toMatchObject({ id: 'cart-9' });
    expect(body.mergeNotes).toEqual([]);
    expect(body.redirectTo).toBe('/en-US/account');
    expect(world.patches).toHaveLength(1);
    expect(world.patches[0]).toMatchObject({ customerId: 'c-1', cartId: 'cart-9' });
    expect(Object.keys(world.patches[0] ?? {}).sort()).toEqual(['cartId', 'customerId', 'signedInAt']);
    expect(world.session.anonymousId).toBe('anon-1');
    expect(JSON.stringify(body)).not.toMatch(/password/i);
    expect(padResponse).not.toHaveBeenCalled();
  });

  it('Sign in carries the anonymous cart: sends the session cart as anonymousCart with MergeWithExistingCustomerCart', async () => {
    await login(valid);
    expect(world.calls[0]).toEqual({
      method: 'POST',
      path: 'login',
      body: { email: 'jane@example.com', password: 'Aa1-valid-pass', anonymousCart: { typeId: 'cart', id: 'cart-1' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart', updateProductData: true },
    });
    expect(readBundle).toHaveBeenCalledWith({ customerId: 'c-1', cartId: 'cart-9' }, expect.objectContaining({ currency: 'USD' }));
  });

  it('retries without the anonymous cart when only that cart is stale', async () => {
    let first = true;
    world.handler = () => {
      if (first) {
        first = false;
        throw failure(400, 'InvalidOperation');
      }
      return { customer: ctCustomer() };
    };
    const res = await login(valid);
    expect(res.status).toBe(200);
    expect(world.calls).toHaveLength(2);
    expect((world.calls[1]?.body as Record<string, unknown>).anonymousCart).toBeUndefined();
  });

  it('a failure while reading the merged bundle does not fail the sign-in', async () => {
    readBundle.mockRejectedValue(new Error('catalog down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await login(valid);
    expect(res.status).toBe(200);
    expect((await res.json()).cart).toBeNull();
    expect(world.patches[0]).toMatchObject({ customerId: 'c-1', cartId: 'cart-9' });
    log.mockRestore();
  });

  it('lists the lines the rules flag after the merge, and removes nothing', async () => {
    readBundle.mockResolvedValue({
      cart: mergedCart({ lines: [{ id: 'l1', name: 'Cable 500' }] as never, issues: [{ lineId: 'l1' }] as never }),
      cartId: 'cart-9',
    });
    const body = await (await login(valid)).json();
    expect(body.mergeNotes).toEqual([{ key: 'review', count: 1, names: 'Cable 500' }]);
  });

  it('returns only a safe return target', async () => {
    expect((await (await login({ ...valid, returnTo: '/en-US/bundle' })).json()).redirectTo).toBe('/en-US/bundle');
    expect((await (await login({ ...valid, returnTo: 'https://evil.com' })).json()).redirectTo).toBe('/en-US/account');
    expect((await (await login({ ...valid, returnTo: '//evil.com' })).json()).redirectTo).toBe('/en-US/account');
    expect((await (await login({ ...valid, locale: 'de-DE', returnTo: '/bundle' })).json()).redirectTo).toBe('/de-DE/bundle');
  });

  it('Unknown and wrong are indistinguishable: identical status, body and headers', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    const unknown = await login({ email: 'nobody@example.com', password: 'Wrong-Password-1' });
    const wrong = await login({ email: 'jane@example.com', password: 'Wrong-Password-1' });
    const malformed = await login({ email: 'nope', password: '' });
    for (const res of [unknown, wrong, malformed]) {
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    const [a, b, c] = await Promise.all([unknown.text(), wrong.text(), malformed.text()]);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(JSON.parse(a)).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Enter a valid email and password.' } });
    expect([...unknown.headers.entries()].filter(([name]) => name !== 'date')).toEqual([...wrong.headers.entries()].filter(([name]) => name !== 'date'));
    expect(padResponse).toHaveBeenCalledTimes(3);
    expect(world.patches).toEqual([]);
  });

  it('Buyer bound to another entry point: a store-bound customer gets the same generic refusal', async () => {
    // commercetools answers a customer that belongs to a store with the same InvalidCredentials as a wrong password.
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    const res = await login({ email: 'store-bound@example.com', password: 'Aa1-valid-pass' });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('5 consecutive failures lock the email for 15 minutes (429 with Retry-After), a different email still gets 401', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    for (let i = 0; i < 5; i += 1) expect((await login({ email: 'lock-test@example.com', password: 'Wrong-Password-1' })).status).toBe(401);
    const locked = await login({ email: 'lock-test@example.com', password: 'Aa1-valid-pass' });
    expect(locked.status).toBe(429);
    const retry = Number(locked.headers.get('retry-after'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(900);
    expect((await locked.json()).error.code).toBe('RATE_LIMITED');
    expect((await login({ email: 'other@example.com', password: 'Wrong-Password-1' })).status).toBe(401);
    expect(world.calls).toHaveLength(6);
  });

  it('a success clears the failure counter', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    for (let i = 0; i < 4; i += 1) await login({ email: 'jane@example.com', password: 'Wrong-Password-1' });
    world.handler = () => ({ customer: ctCustomer() });
    expect((await login(valid)).status).toBe(200);
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    expect((await login({ email: 'jane@example.com', password: 'Wrong-Password-1' })).status).toBe(401);
  });

  it('limits one IP to 20 attempts per 15 minutes', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    for (let i = 0; i < 20; i += 1) expect((await login({ email: `u${i}@example.com`, password: 'x' }, sameIp('203.0.113.9'))).status).toBe(401);
    const blocked = await login(valid, sameIp('203.0.113.9'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).not.toBeNull();
  });

  it('refuses a request from another origin with 403 FORBIDDEN and calls nothing', async () => {
    const res = await login(valid, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
    expect(world.calls).toEqual([]);
  });

  it('answers 413 above 4 KB and 415 for a non-JSON body', async () => {
    expect((await login({ email: 'a@b.co', password: 'x'.repeat(5000) })).status).toBe(413);
    expect((await login('x', { 'content-type': 'text/plain' })).status).toBe(415);
  });

  it('a commercetools outage is a generic 502 that logs no password', async () => {
    world.handler = () => {
      throw Object.assign(new Error('boom'), { statusCode: 503, originalRequest: { body: { password: 'Aa1-valid-pass' } } });
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await login(valid);
    expect(res.status).toBe(502);
    expect(JSON.stringify(log.mock.calls)).not.toContain('Aa1-valid-pass');
    log.mockRestore();
  });
});
