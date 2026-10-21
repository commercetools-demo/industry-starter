// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const SECRET = 'a'.repeat(40);
const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const als = vi.hoisted(() => ({ current: null as Map<string, string> | null }));

vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => {
    const store = als.current ?? jar.store;
    return { get: (name: string) => (store.has(name) ? { name, value: store.get(name) } : undefined) };
  },
}));

import {
  SESSION_COOKIE, changeMarket, clearSessionCookie, createSessionToken, ensureAnonymousId,
  getMarket, getSession, sanitizeSession, setMarketCookie, setSessionCookie, verifySessionToken,
} from '@/lib/session';

beforeEach(() => {
  jar.store.clear();
  als.current = null;
});

const sign = (secret: string, exp: string | number) =>
  new SignJWT({ cartId: 'c1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

describe('Session', () => {
  it('round trip keeps the session fields', async () => {
    const token = await createSessionToken({ cartId: 'c1', country: 'US' });
    expect(await verifySessionToken(token)).toEqual({ cartId: 'c1', country: 'US' });
  });

  it('Tampered cookie: an invalid signature gives an empty session and no error', async () => {
    const token = await createSessionToken({ cartId: 'c1' });
    expect(await verifySessionToken(`${token.slice(0, -3)}abc`)).toEqual({});
    expect(await verifySessionToken('garbage')).toEqual({});
    expect(await verifySessionToken(undefined)).toEqual({});
  });

  it('Tampered cookie: a token signed with another secret gives an empty session', async () => {
    expect(await verifySessionToken(await sign('b'.repeat(40), '30d'))).toEqual({});
  });

  it('Tampered cookie: an expired token gives an empty session', async () => {
    expect(await verifySessionToken(await sign(SECRET, Math.floor(Date.now() / 1000) - 60))).toEqual({});
  });

  it('Session never carries a token or card data: unknown keys are dropped by sanitizeSession', async () => {
    const clean = sanitizeSession({ cartId: 'c1', accessToken: 'x', cardNumber: '4111', customerId: 5 });
    expect(clean).toEqual({ cartId: 'c1' });
    const token = await createSessionToken({ cartId: 'c1', accessToken: 'x' } as never);
    expect(await verifySessionToken(token)).toEqual({ cartId: 'c1' });
  });

  it('Market change: country, currency and locale change together and cartId is reset', () => {
    const next = changeMarket({ cartId: 'c1', country: 'US', currency: 'USD', locale: 'en-US' }, 'en-CA');
    expect(next).toEqual({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect('cartId' in next).toBe(false);
  });

  it('Market change keeps the customer fields, anonymousId and collectionStoreKey', () => {
    const before = {
      customerId: 'u1', customerEmail: 'a@example.com', customerFirstName: 'A', customerLastName: 'B',
      anonymousId: 'anon', collectionStoreKey: 'mcf-store-1', cartId: 'c1',
    };
    const next = changeMarket(before, 'en-CA');
    const kept: Record<string, string> = { ...before };
    delete kept.cartId;
    expect(next).toMatchObject(kept);
  });

  it('Session cookie is httpOnly, sameSite lax, 30 days', () => {
    const res = setSessionCookie(NextResponse.json({}), 'tok');
    const c = res.cookies.get(SESSION_COOKIE);
    expect(c).toMatchObject({ value: 'tok', httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
  });

  it('clearSessionCookie expires the cookie', () => {
    const c = clearSessionCookie(NextResponse.json({})).cookies.get(SESSION_COOKIE);
    expect(c?.maxAge).toBe(0);
  });

  it('A token over 3800 characters is refused', async () => {
    await expect(createSessionToken({ cartId: 'x'.repeat(4000) })).rejects.toThrow();
  });

  it('Two shoppers: concurrent getSession calls each return their own cartId', async () => {
    const a = await createSessionToken({ cartId: 'cart-a' });
    const b = await createSessionToken({ cartId: 'cart-b' });
    // The mocked cookie store is resolved per call; no module level state in session.ts.
    const read = async (token: string) => {
      const store = new Map([[SESSION_COOKIE, token]]);
      als.current = store;
      const promise = getSession();
      als.current = null;
      return promise;
    };
    const [sa, sb] = await Promise.all([read(a), read(b)]);
    expect(sa.cartId).toBe('cart-a');
    expect(sb.cartId).toBe('cart-b');
  });

  it('getMarket falls back to the market cookie then to en-US', async () => {
    expect(await getMarket()).toEqual({ country: 'US', currency: 'USD', locale: 'en-US' });
    jar.store.set('malva-locale', 'en-CA');
    expect(await getMarket()).toEqual({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    jar.store.set(SESSION_COOKIE, await createSessionToken({ country: 'US', currency: 'USD', locale: 'en-US' }));
    expect(await getMarket()).toEqual({ country: 'US', currency: 'USD', locale: 'en-US' });
  });

  it('setMarketCookie is httpOnly, lax, one year', () => {
    const c = setMarketCookie(NextResponse.json({}), 'en-CA').cookies.get('malva-locale');
    expect(c).toMatchObject({ value: 'en-CA', httpOnly: true, sameSite: 'lax', maxAge: 31536000 });
  });

  it('ensureAnonymousId keeps an existing id', () => {
    expect(ensureAnonymousId({ anonymousId: 'x' }).anonymousId).toBe('x');
    expect(ensureAnonymousId({}).anonymousId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
