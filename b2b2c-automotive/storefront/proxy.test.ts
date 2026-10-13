// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession, verifySession } from '@/lib/session-core';
import type { StoreSummary } from '@/lib/types';
import { makeRequest } from '@/test/request';
import { config, proxy } from './proxy';

const getStoreContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/stores', () => ({ getStoreContext }));
const getRecordStatus = vi.hoisted(() => vi.fn());
const endRecord = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/impersonation', () => ({ getRecordStatus, endRecord }));

const storeFor = (key: string, n: string): StoreSummary => ({
  key,
  name: key,
  nameLocalized: {},
  countries: ['DE'],
  distributionChannels: [],
  supplyChannels: [],
  storeKey: key,
  distributionChannelId: `dist-${n}`,
  supplyChannelId: `supply-${n}`,
  productSelectionId: `sel-${n}`,
});
const STORES: Record<string, StoreSummary> = { acme: storeFor('acme', 'h'), bolt: storeFor('bolt', 'l') };

beforeEach(() => {
  getStoreContext.mockReset();
  getStoreContext.mockImplementation(async (key: string) => STORES[key] ?? null);
});

const req = (url: string, cookie?: string) => {
  const base = makeRequest(url, cookie ? { headers: { cookie } } : undefined);
  return new NextRequest(base);
};
const cookieOf = (res: Response) => /malva_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
const sessionCookie = async (session: Parameters<typeof signSession>[0]) => `malva_session=${await signSession(session, getSessionSecret())}`;
const decode = (token: string | undefined) => verifySession(token, getSessionSecret());

describe('Locale routing for two locales: proxy', () => {
  it('Bare path redirects to /de-DE', async () => {
    const res = await proxy(req('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/de-DE');
  });
  it('Cookie en-US redirects to /en-US', async () => {
    const res = await proxy(req('/', 'your-shop-country-locale=en-US'));
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US');
  });
  it('Prefixed path sets x-next-intl-locale', async () => {
    const res = await proxy(req('/en-US/acme'));
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en-US');
  });
  it('Prefixed path updates the cookie', async () => {
    const res = await proxy(req('/en-US/acme', 'your-shop-country-locale=de-DE'));
    expect(res.cookies.get('your-shop-country-locale')?.value).toBe('en-US');
  });
  it('Unsupported locale passes through to the layout', async () => {
    const res = await proxy(req('/fr-FR/acme'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(getStoreContext).not.toHaveBeenCalled();
  });
});

describe('Store resolved from the path: proxy', () => {
  it('Two resellers', async () => {
    const a = await proxy(req('/de-DE/acme'));
    const b = await proxy(req('/de-DE/bolt'));
    expect(a.headers.get('x-middleware-request-x-store-key')).toBe('acme');
    expect(b.headers.get('x-middleware-request-x-store-key')).toBe('bolt');
    const sa = await decode(cookieOf(a));
    const sb = await decode(cookieOf(b));
    expect(sa).toMatchObject({ storeKey: 'acme', distributionChannelId: 'dist-h', supplyChannelId: 'supply-h', productSelectionId: 'sel-h' });
    expect(sb).toMatchObject({ storeKey: 'bolt', distributionChannelId: 'dist-l', supplyChannelId: 'supply-l', productSelectionId: 'sel-l' });
  });

  it('Unknown store', async () => {
    const res = await proxy(req('/de-DE/nope'));
    expect(res.status).toBe(404);
    // Not `/de-DE`: that is the Malva home now.
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/de-DE\/store-not-found$/);
    expect(getStoreContext).toHaveBeenCalledTimes(1);
    expect(cookieOf(res)).toBeUndefined();
    expect(res.headers.get('x-middleware-request-x-store-key')).toBeNull();
  });

  it('No store segment', async () => {
    const res = await proxy(req('/de-DE'));
    expect(res.status).toBe(200);
    expect(getStoreContext).not.toHaveBeenCalled();
    expect(cookieOf(res)).toBeUndefined();
  });

  it('Malva listing is not a store', async () => {
    const cookie = await sessionCookie({ cartId: 'cart-1', ...STORES.acme });
    const res = await proxy(req('/de-DE/categories/brakes', cookie));
    expect(res.status).toBe(200);
    expect(getStoreContext).not.toHaveBeenCalled();
    expect(cookieOf(res)).toBeUndefined(); // the session is not touched
    expect(res.headers.get('x-middleware-request-x-store-key')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('Malva listing without a session leaves none behind', async () => {
    const res = await proxy(req('/en-US/categories/brakes'));
    expect(getStoreContext).not.toHaveBeenCalled();
    expect(cookieOf(res)).toBeUndefined();
  });

  it('Store changes mid-session', async () => {
    const res = await proxy(req('/de-DE/bolt', await sessionCookie({ customerId: 'c1', cartId: 'cart-1', ...STORES.acme })));
    const s = await decode(cookieOf(res));
    expect(s).toEqual({
      customerId: 'c1',
      storeKey: 'bolt',
      distributionChannelId: 'dist-l',
      supplyChannelId: 'supply-l',
      productSelectionId: 'sel-l',
    });
    expect(s.cartId).toBeUndefined();
  });

  it('Same store keeps the cart', async () => {
    const cookie = await sessionCookie({ cartId: 'cart-1', ...STORES.acme });
    const res = await proxy(req('/de-DE/acme', cookie));
    expect(cookieOf(res)).toBeUndefined(); // nothing changed, nothing written
    expect(res.headers.get('x-middleware-request-cookie')).toBe(cookie);
    expect(res.headers.get('x-middleware-request-x-store-key')).toBe('acme');
  });

  it('Fresh session is forwarded to the request cookie header', async () => {
    const res = await proxy(req('/de-DE/acme', 'other=1'));
    const forwarded = res.headers.get('x-middleware-request-cookie') ?? '';
    expect(forwarded).toContain('other=1');
    const token = /malva_session=([^;]+)/.exec(forwarded)?.[1];
    expect(token).toBe(cookieOf(res));
    expect((await decode(token)).storeKey).toBe('acme');
  });

  it('The session cookie has the session flags', async () => {
    const res = await proxy(req('/de-DE/acme'));
    const header = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(header).toContain('httponly');
    expect(header).toContain('samesite=lax');
    expect(header).toContain('path=/');
  });

  it('A tampered session cookie is replaced, not trusted', async () => {
    const res = await proxy(req('/de-DE/acme', 'malva_session=garbage.garbage.garbage'));
    expect(await decode(cookieOf(res))).toMatchObject({ storeKey: 'acme' });
  });

  it('Outage without cache is 503', async () => {
    getStoreContext.mockRejectedValue({ statusCode: 503 });
    const res = await proxy(req('/de-DE/acme'));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Service unavailable');
  });

  it('Outage with stale entry continues', async () => {
    // getStoreContext serves the stale entry itself, so the proxy just sees a store.
    getStoreContext.mockResolvedValue(STORES.acme);
    const res = await proxy(req('/de-DE/acme'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-x-store-key')).toBe('acme');
  });

  it('Dev path and api path never trigger a lookup', async () => {
    await proxy(req('/dev/tokens'));
    await proxy(req('/api/health'));
    await proxy(req('/favicon.ico'));
    await proxy(req('/_next/static/x.js'));
    expect(getStoreContext).not.toHaveBeenCalled();
  });

  it('A client supplied x-store-key is dropped', async () => {
    const base = new NextRequest(makeRequest('/de-DE', { headers: { 'x-store-key': 'evil' } }));
    const res = await proxy(base);
    expect(res.headers.get('x-middleware-request-x-store-key')).toBeNull();
  });
});

describe('Shop as customer: idle expiry in the proxy (V-06)', () => {
  const nowS = () => Math.floor(Date.now() / 1000);
  const shopAs = (over: Record<string, unknown> = {}) => ({
    ...storeSession(),
    customerId: 'cust-1',
    cartId: 'cart-1',
    impersonatedBy: 'seller-1',
    impJti: 'jti-1',
    impImpExp: nowS() + 60,
    impAbs: nowS() + 1000,
    ...over,
  });
  const storeSession = () => ({ storeKey: 'acme', distributionChannelId: 'dist-h', supplyChannelId: 'supply-h', productSelectionId: 'sel-h', cartId: 'cart-1' });

  beforeEach(() => {
    getRecordStatus.mockReset().mockResolvedValue('active');
    endRecord.mockReset().mockResolvedValue(undefined);
  });

  it('an active session gets its idle deadline renewed on a page request', async () => {
    const before = nowS() + 5;
    const res = await proxy(req('/de-DE/acme', await sessionCookie(shopAs({ impImpExp: before }))));
    const next = await decode(cookieOf(res));
    expect(next.customerId).toBe('cust-1');
    expect(next.impImpExp).toBeGreaterThan(nowS() + 100);
    expect(next.impImpExp).toBeLessThanOrEqual(nowS() + 120);
    expect(next.cartId).toBe('cart-1');
    expect(endRecord).not.toHaveBeenCalled();
  });
  it('an idle session is signed out, loses the cart and the actor, and its record is ended', async () => {
    const res = await proxy(req('/de-DE/acme', await sessionCookie(shopAs({ impImpExp: nowS() - 1 }))));
    const next = await decode(cookieOf(res));
    expect(next).toMatchObject({ storeKey: 'acme' });
    for (const key of ['customerId', 'cartId', 'impersonatedBy', 'impJti', 'impImpExp', 'impAbs']) expect(next).not.toHaveProperty(key);
    expect(next.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(endRecord).toHaveBeenCalledWith('jti-1');
  });
  it('the absolute cap ends it even when the idle deadline is open', async () => {
    const res = await proxy(req('/de-DE/acme', await sessionCookie(shopAs({ impAbs: nowS() - 1 }))));
    expect(await decode(cookieOf(res))).not.toHaveProperty('customerId');
  });
  it('a revoked record (ended in the portal) ends the session at the next page request', async () => {
    getRecordStatus.mockResolvedValue('ended');
    const res = await proxy(req('/de-DE/acme', await sessionCookie(shopAs())));
    expect(await decode(cookieOf(res))).not.toHaveProperty('impersonatedBy');
    expect(getRecordStatus).toHaveBeenCalledWith('jti-1');
  });
  it('a normal session makes no record lookup', async () => {
    await proxy(req('/de-DE/acme', await sessionCookie({ ...storeSession(), customerId: 'cust-1' })));
    expect(getRecordStatus).not.toHaveBeenCalled();
  });
});

describe('Checkout return URL: proxy exclusion', () => {
  it('/checkout/return passes without locale redirect or lookup', async () => {
    for (const path of ['/checkout/return', '/checkout/return?orderId=abc']) {
      const res = await proxy(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
    expect(getStoreContext).not.toHaveBeenCalled();
  });
  it('The matcher excludes /checkout/return but not other paths', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/checkout/return')).toBe(false);
    expect(re.test('/de-DE/acme')).toBe(true);
    expect(re.test('/de-DE/acme/checkout/return')).toBe(true);
    expect(re.test('/api/health')).toBe(false);
  });
});
