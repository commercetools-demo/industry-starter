/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { SESSION_COOKIE_NAME, signSession } from '@/lib/session-core';
import type { Session } from '@/lib/types';
import { makeRequest } from './test/request';
import { proxy } from './proxy';

const req = (url: string, cookie?: string) => {
  const base = makeRequest(url, { cookie });
  return new NextRequest(base.url, { headers: base.headers });
};
const signedIn = async (session: Session = { customerId: 'c1', businessUnitKey: 'mau-bu-north' }, extra = '') =>
  `${SESSION_COOKIE_NAME}=${await signSession(session, getSessionSecret())}${extra}`;
const location = (res: Response) => {
  const raw = res.headers.get('location');
  return raw ? new URL(raw) : null;
};

describe('Locale routing: proxy', () => {
  it('Bare path redirects to /de-DE', async () => {
    const res = await proxy(req('/'));
    expect(res.status).toBe(307);
    expect(location(res)?.pathname).toBe('/de-DE');
  });
  it('Cookie en-US redirects to /en-US', async () => {
    const res = await proxy(req('/', 'your-shop-country-locale=en-US'));
    expect(location(res)?.pathname).toBe('/en-US');
  });
  it('Prefixed path sets x-next-intl-locale', async () => {
    const res = await proxy(req('/en-US/orders', await signedIn()));
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en-US');
  });
  it('Prefixed path updates the cookie', async () => {
    const res = await proxy(req('/en-US/sign-in', 'your-shop-country-locale=de-DE'));
    expect(res.cookies.get('your-shop-country-locale')?.value).toBe('en-US');
  });
  it('Unsupported locale passes through to the layout', async () => {
    const res = await proxy(req('/fr-FR/orders'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('Bare path: signed-out redirect', () => {
  it('Bare path then sign-in', async () => {
    const first = await proxy(req('/'));
    expect(location(first)?.pathname).toBe('/de-DE');
    const second = await proxy(req('/de-DE'));
    expect(second.status).toBe(307);
    expect(location(second)?.pathname).toBe('/de-DE/sign-in');
    expect(location(second)?.search).toBe('');
  });
  it('A signed-out portal route redirects to sign-in with the return path', async () => {
    const res = await proxy(req('/de-DE/catalog?tab=assortment&sku=BP-1'));
    expect(res.status).toBe(307);
    expect(location(res)?.pathname).toBe('/de-DE/sign-in');
    expect(location(res)?.searchParams.get('next')).toBe('/catalog?tab=assortment&sku=BP-1');
  });
  it('The locale of the path is kept', async () => {
    const res = await proxy(req('/en-US/orders'));
    expect(location(res)?.pathname).toBe('/en-US/sign-in');
    expect(location(res)?.searchParams.get('next')).toBe('/orders');
  });
  it.each(['sign-in', 'register', 'reset', 'reset/some-token', 'pending-approval'])('The auth route %s is open to a signed-out visitor', async (route) => {
    const res = await proxy(req(`/de-DE/${route}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
  it('A return path that would leave the site is dropped', async () => {
    for (const path of ['/de-DE//evil', '/de-DE/%5Cevil', '/de-DE/.//evil']) {
      const res = await proxy(req(path));
      expect(res.status).toBe(307);
      const next = location(res)?.searchParams.get('next');
      expect(!next || next.startsWith('/')).toBe(true);
      expect(next?.startsWith('//') ?? false).toBe(false);
    }
  });
  it('A tampered cookie is signed out', async () => {
    const cookie = await signedIn();
    const res = await proxy(req('/de-DE/catalog', `${cookie.slice(0, -3)}xyz`));
    expect(location(res)?.pathname).toBe('/de-DE/sign-in');
  });
  it('A session without customerId is signed out', async () => {
    const res = await proxy(req('/de-DE/catalog', await signedIn({ locale: 'de-DE' })));
    expect(location(res)?.pathname).toBe('/de-DE/sign-in');
  });
  it('Dev path and api path are not touched', async () => {
    expect((await proxy(req('/dev/tokens'))).headers.get('location')).toBeNull();
    expect((await proxy(req('/api/health'))).headers.get('location')).toBeNull();
  });
});

describe('Bare path: signed-in visitor', () => {
  it('A portal route passes', async () => {
    const res = await proxy(req('/de-DE/catalog', await signedIn()));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
  it('Sign-in with a valid session goes home', async () => {
    const res = await proxy(req('/en-US/sign-in', await signedIn()));
    expect(res.status).toBe(307);
    expect(location(res)?.pathname).toBe('/en-US');
  });
  it('A pending session may stay on sign-in and open pending-approval', async () => {
    const cookie = await signedIn({ customerId: 'c1', pending: true });
    expect((await proxy(req('/de-DE/sign-in', cookie))).headers.get('location')).toBeNull();
    expect((await proxy(req('/de-DE/pending-approval', cookie))).headers.get('location')).toBeNull();
  });
});
