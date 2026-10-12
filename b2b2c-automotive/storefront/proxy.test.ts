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
const STORES: Record<string, StoreSummary> = { hartmann: storeFor('hartmann', 'h'), lindner: storeFor('lindner', 'l') };

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
    const res = await proxy(req('/en-US/hartmann'));
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en-US');
  });
  it('Prefixed path updates the cookie', async () => {
    const res = await proxy(req('/en-US/hartmann', 'your-shop-country-locale=de-DE'));
    expect(res.cookies.get('your-shop-country-locale')?.value).toBe('en-US');
  });
  it('Unsupported locale passes through to the layout', async () => {
    const res = await proxy(req('/fr-FR/hartmann'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(getStoreContext).not.toHaveBeenCalled();
  });
});

describe('Store resolved from the path: proxy', () => {
  it('Two resellers', async () => {
    const a = await proxy(req('/de-DE/hartmann'));
    const b = await proxy(req('/de-DE/lindner'));
    expect(a.headers.get('x-middleware-request-x-store-key')).toBe('hartmann');
    expect(b.headers.get('x-middleware-request-x-store-key')).toBe('lindner');
    const sa = await decode(cookieOf(a));
    const sb = await decode(cookieOf(b));
    expect(sa).toMatchObject({ storeKey: 'hartmann', distributionChannelId: 'dist-h', supplyChannelId: 'supply-h', productSelectionId: 'sel-h' });
    expect(sb).toMatchObject({ storeKey: 'lindner', distributionChannelId: 'dist-l', supplyChannelId: 'supply-l', productSelectionId: 'sel-l' });
  });

  it('Unknown store', async () => {
    const res = await proxy(req('/de-DE/nope'));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/de-DE$/);
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

  it('Store changes mid-session', async () => {
    const res = await proxy(req('/de-DE/lindner', await sessionCookie({ customerId: 'c1', cartId: 'cart-1', ...STORES.hartmann })));
    const s = await decode(cookieOf(res));
    expect(s).toEqual({
      customerId: 'c1',
      storeKey: 'lindner',
      distributionChannelId: 'dist-l',
      supplyChannelId: 'supply-l',
      productSelectionId: 'sel-l',
    });
    expect(s.cartId).toBeUndefined();
  });

  it('Same store keeps the cart', async () => {
    const cookie = await sessionCookie({ cartId: 'cart-1', ...STORES.hartmann });
    const res = await proxy(req('/de-DE/hartmann', cookie));
    expect(cookieOf(res)).toBeUndefined(); // nothing changed, nothing written
    expect(res.headers.get('x-middleware-request-cookie')).toBe(cookie);
    expect(res.headers.get('x-middleware-request-x-store-key')).toBe('hartmann');
  });

  it('Fresh session is forwarded to the request cookie header', async () => {
    const res = await proxy(req('/de-DE/hartmann', 'other=1'));
    const forwarded = res.headers.get('x-middleware-request-cookie') ?? '';
    expect(forwarded).toContain('other=1');
    const token = /malva_session=([^;]+)/.exec(forwarded)?.[1];
    expect(token).toBe(cookieOf(res));
    expect((await decode(token)).storeKey).toBe('hartmann');
  });

  it('The session cookie has the session flags', async () => {
    const res = await proxy(req('/de-DE/hartmann'));
    const header = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(header).toContain('httponly');
    expect(header).toContain('samesite=lax');
    expect(header).toContain('path=/');
  });

  it('A tampered session cookie is replaced, not trusted', async () => {
    const res = await proxy(req('/de-DE/hartmann', 'malva_session=garbage.garbage.garbage'));
    expect(await decode(cookieOf(res))).toMatchObject({ storeKey: 'hartmann' });
  });

  it('Outage without cache is 503', async () => {
    getStoreContext.mockRejectedValue({ statusCode: 503 });
    const res = await proxy(req('/de-DE/hartmann'));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Service unavailable');
  });

  it('Outage with stale entry continues', async () => {
    // getStoreContext serves the stale entry itself, so the proxy just sees a store.
    getStoreContext.mockResolvedValue(STORES.hartmann);
    const res = await proxy(req('/de-DE/hartmann'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-x-store-key')).toBe('hartmann');
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
    expect(re.test('/de-DE/hartmann')).toBe(true);
    expect(re.test('/de-DE/hartmann/checkout/return')).toBe(true);
    expect(re.test('/api/health')).toBe(false);
  });
});
