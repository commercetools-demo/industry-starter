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

  it('a prefetch or other background fetch of a page in the other market never sets a cookie (a market switch with a bag lost the bag to a stale prefetch)', async () => {
    const token = await createSessionToken({ ...CA, cartId: 'cart-2', anonymousId: 'a1' });
    const cookie = `malva-session=${token}; malva-locale=en-CA`;
    // Next removes its own prefetch headers before the proxy runs: what remains is what the browser sends (a fetch is dest `empty`).
    for (const headers of [{ 'sec-fetch-dest': 'empty' }, { 'sec-purpose': 'prefetch' }, { purpose: 'prefetch' }] as Record<string, string>[]) {
      const request = new NextRequest('http://localhost/en-US/p/casa-espresso/MCF-POD-CASA-10?_rsc=x', { headers: { cookie, ...headers } });
      const res = await proxy(request);
      expect(res.headers.get('set-cookie')).toBeNull();
      // the page still renders in the URL market, from the request cookies
      expect(res.headers.get('x-middleware-request-cookie') ?? '').toContain('malva-locale=en-US');
    }
    // a page load of the same URL still moves the session (document, or a client that sends no Sec-Fetch-Dest)
    for (const extra of [{ 'sec-fetch-dest': 'document' }, {}] as Record<string, string>[]) {
      const visit = await proxy(new NextRequest('http://localhost/en-US/cart', { headers: { cookie, ...extra } }));
      expect(visit.headers.get('set-cookie')).toContain('malva-session=');
    }
  });
});
