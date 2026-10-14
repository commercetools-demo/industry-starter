// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined),
    set: (name: string, value: string) => void jar.values.set(name, value),
    delete: (name: string) => void jar.values.delete(name),
  }),
}));

beforeEach(() => {
  jar.values.clear();
  vi.resetModules();
});

const post = (json: unknown) => makeRequest('/api/locale', { method: 'POST', json });

describe('Locale triple: /api/locale', () => {
  it('Post switches the triple together', async () => {
    const { POST } = await import('./route');
    const { getSession, SESSION_COOKIE } = await import('@/lib/session');
    const res = await POST(post({ locale: 'en-US' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(await getSession()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(jar.values.get('your-shop-country-locale')).toBe('en-US');
    expect(jar.values.has(SESSION_COOKIE)).toBe(true);
  });

  it('Post to a different currency clears the cart', async () => {
    const { POST } = await import('./route');
    const { setSessionCookie, getSession } = await import('@/lib/session');
    await setSessionCookie({ customerId: 'c1', cartId: 'cart-1', locale: 'de-DE', currency: 'EUR', country: 'DE', businessUnitKey: 'mau-bu-north' });
    await POST(post({ locale: 'en-US' }));
    const session = await getSession();
    expect(session.cartId).toBeUndefined();
    expect(session).toMatchObject({ customerId: 'c1', businessUnitKey: 'mau-bu-north', currency: 'USD' });
  });

  it('The cart survives a switch to the same currency', async () => {
    const { POST } = await import('./route');
    const { setSessionCookie, getSession } = await import('@/lib/session');
    await setSessionCookie({ cartId: 'cart-1', locale: 'de-DE', currency: 'EUR', country: 'DE' });
    await POST(post({ locale: 'de-DE' }));
    expect((await getSession()).cartId).toBe('cart-1');
  });

  it('Unsupported locale is 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({ locale: 'fr-FR' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unsupported locale' });
    expect(jar.values.size).toBe(0);
  });

  it('A missing or malformed body is 400', async () => {
    const { POST } = await import('./route');
    expect((await POST(post({}))).status).toBe(400);
    const bad = new Request('http://localhost:3001/api/locale', { method: 'POST', body: '{nope', headers: { 'content-type': 'application/json' } });
    expect((await POST(bad)).status).toBe(400);
  });

  it('Get falls back to the cookie then to de-DE', async () => {
    const { GET } = await import('./route');
    expect(await (await GET()).json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    jar.values.set('your-shop-country-locale', 'en-US');
    expect(await (await GET()).json()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
  });

  it('Tampered session cookie falls back to defaults', async () => {
    const { GET } = await import('./route');
    const { SESSION_COOKIE } = await import('@/lib/session');
    jar.values.set(SESSION_COOKIE, 'not.a.token');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });
});
