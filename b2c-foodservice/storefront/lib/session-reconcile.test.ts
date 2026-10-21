// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';
import { reconcileMarket } from '@/lib/session-reconcile';
import { createSessionToken, verifySessionToken } from '@/lib/session';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));

const US = { country: 'US', currency: 'USD', locale: 'en-US' };
const CA = { country: 'CA', currency: 'CAD', locale: 'en-CA' };

beforeEach(() => {
  process.env.SESSION_SECRET = 'a'.repeat(40);
});

describe('URL market is the source of truth (FIX-2)', () => {
  it('a Canadian session on /en-US is moved to the US market and drops the cart and the store', async () => {
    const token = await createSessionToken({ ...CA, cartId: 'cart-1', collectionStoreKey: 'mcf-store-x', customerId: 'c1', anonymousId: 'a1' });
    const out = await reconcileMarket('en-US', token, 'en-CA');
    const session = await verifySessionToken(out?.cookies.find((c) => c.name === 'malva-session')?.value);
    expect(session).toMatchObject({ ...US, customerId: 'c1', anonymousId: 'a1' });
    expect(session.cartId).toBeUndefined();
    expect(session.collectionStoreKey).toBeUndefined();
    expect(out?.cookies.find((c) => c.name === 'malva-locale')?.value).toBe('en-US');
  });

  it('a cart-only session (no market fields) takes its market from the market cookie', async () => {
    const token = await createSessionToken({ cartId: 'cart-1', anonymousId: 'a1' });
    const out = await reconcileMarket('en-US', token, 'en-CA');
    const session = await verifySessionToken(out?.cookies.find((c) => c.name === 'malva-session')?.value);
    expect(session.cartId).toBeUndefined();
    expect(session).toMatchObject({ ...US, anonymousId: 'a1' });
    expect(await reconcileMarket('en-CA', token, 'en-CA')).toBeNull();
  });

  it('a session already in the URL market is untouched, the market cookie is added when missing', async () => {
    const token = await createSessionToken({ ...US, cartId: 'cart-1' });
    expect(await reconcileMarket('en-US', token, 'en-US')).toBeNull();
    const out = await reconcileMarket('en-US', token, undefined);
    expect(out?.cookies.map((c) => c.name)).toEqual(['malva-locale']);
  });

  it('a missing or tampered session is never created or repaired', async () => {
    expect((await reconcileMarket('en-CA', undefined, 'en-CA'))).toBeNull();
    const out = await reconcileMarket('en-CA', 'not-a-token', 'en-US');
    expect(out?.cookies.map((c) => c.name)).toEqual(['malva-locale']);
  });

  it('the proxy rewrites the request cookie so the page renders in the URL market, and sets both cookies', async () => {
    const token = await createSessionToken({ ...CA, cartId: 'cart-1' });
    const request = new NextRequest('http://localhost/en-US', { headers: { cookie: `malva-session=${token}; malva-locale=en-CA` } });
    const res = await proxy(request);
    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toContain('malva-session=');
    expect(set).toContain('malva-locale=en-US');
    expect(request.cookies.get('malva-locale')?.value).toBe('en-US');
    const forwarded = res.headers.get('x-middleware-request-cookie') ?? '';
    expect(forwarded).toContain('malva-locale=en-US');
    expect(forwarded).not.toContain(token);
  });
});
