// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession, verifySession } from '@/lib/session-core';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>(), sets: [] as Array<{ name: string; value: string; options: Record<string, unknown> }> }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.sets.push({ name, value, options });
      jar.values.set(name, value);
    },
    delete: (name: string) => jar.values.delete(name),
  }),
}));

import { GET, POST } from './route';

const post = (locale: unknown) =>
  POST(makeRequest('/api/locale', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale }) }));
const sessionNow = () => verifySession(jar.values.get('malva_session'), getSessionSecret());

beforeEach(() => {
  jar.values.clear();
  jar.sets.length = 0;
});

describe('Stateless session: /api/locale', () => {
  it('Post switches the triple together', async () => {
    const res = await post('en-US');
    expect(await res.json()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(await sessionNow()).toMatchObject({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(jar.values.get('your-shop-country-locale')).toBe('en-US');
    const flags = jar.sets.find((s) => s.name === 'malva_session')?.options;
    expect(flags).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it('Post back to de-DE gives EUR and DE', async () => {
    await post('en-US');
    expect(await (await post('de-DE')).json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  it('Post to a different currency clears the cart', async () => {
    jar.values.set('malva_session', await signSession({ cartId: 'cart-1', customerId: 'c1', locale: 'de-DE', currency: 'EUR', country: 'DE' }, getSessionSecret()));
    await post('en-US');
    const s = await sessionNow();
    expect(s.cartId).toBeUndefined();
    expect(s.customerId).toBe('c1');
  });

  it('Post to the same locale keeps the cart', async () => {
    jar.values.set('malva_session', await signSession({ cartId: 'cart-1', locale: 'de-DE', currency: 'EUR', country: 'DE' }, getSessionSecret()));
    await post('de-DE');
    expect((await sessionNow()).cartId).toBe('cart-1');
  });

  it('Unsupported locale is 400', async () => {
    for (const bad of ['fr-FR', 'DE-de', '', 7, null]) {
      const res = await post(bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(jar.sets).toHaveLength(0);
  });

  it('A body that is not JSON is 400', async () => {
    const res = await POST(makeRequest('/api/locale', { method: 'POST', body: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('Get falls back to the cookie then to de-DE', async () => {
    expect(await (await GET()).json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    jar.values.set('your-shop-country-locale', 'en-US');
    expect(await (await GET()).json()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
  });

  it('Get prefers the session triple', async () => {
    jar.values.set('your-shop-country-locale', 'en-US');
    jar.values.set('malva_session', await signSession({ locale: 'de-DE', currency: 'EUR', country: 'DE' }, getSessionSecret()));
    expect((await (await GET()).json()).locale).toBe('de-DE');
  });

  it('Tampered session cookie falls back to defaults', async () => {
    jar.values.set('malva_session', 'tampered.value.here');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });
});
