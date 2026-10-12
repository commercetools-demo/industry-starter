// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface SetCall {
  name: string;
  value: string;
  options: Record<string, unknown>;
}
const jar = vi.hoisted(() => ({ values: new Map<string, string>(), sets: [] as unknown[], deletes: [] as string[] }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.sets.push({ name, value, options });
      jar.values.set(name, value);
    },
    delete: (name: string) => {
      jar.deletes.push(name);
      jar.values.delete(name);
    },
  }),
}));

const sets = () => jar.sets as SetCall[];

beforeEach(() => {
  jar.values.clear();
  jar.sets.length = 0;
  jar.deletes.length = 0;
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('Stateless session: cookie and helpers', () => {
  it('Cookie flags', async () => {
    const { setSessionCookie, SESSION_COOKIE } = await import('./session');
    await setSessionCookie({ customerId: 'c1' });
    const [call] = sets();
    expect(call.name).toBe(SESSION_COOKIE);
    expect(call.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });
    expect(call.options.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it('Cookie is Secure only in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { setSessionCookie } = await import('./session');
    await setSessionCookie({});
    expect(sets()[0].options.secure).toBe(true);
  });

  it('Session round trip through the cookie', async () => {
    const { setSessionCookie, getSession } = await import('./session');
    await setSessionCookie({ customerId: 'c1', cartId: 'cart' });
    expect(await getSession()).toEqual({ customerId: 'c1', cartId: 'cart' });
  });

  it('Tampered cookie gives an empty session', async () => {
    const { setSessionCookie, getSession, SESSION_COOKIE } = await import('./session');
    await setSessionCookie({ customerId: 'c1' });
    const v = jar.values.get(SESSION_COOKIE) ?? '';
    jar.values.set(SESSION_COOKIE, `${v.slice(0, -3)}${v.endsWith('aaa') ? 'bbb' : 'aaa'}`);
    expect(await getSession()).toEqual({});
  });

  it('clearSessionCookie deletes the cookie', async () => {
    const { clearSessionCookie, SESSION_COOKIE } = await import('./session');
    await clearSessionCookie();
    expect(jar.deletes).toEqual([SESSION_COOKIE]);
  });

  it('updateSession writes once', async () => {
    const { updateSession } = await import('./session');
    const next = await updateSession((s) => ({ ...s, customerId: 'c1' }));
    expect(next).toEqual({ customerId: 'c1' });
    expect(sets()).toHaveLength(1);
  });

  it('updateSession writes nothing when the transform throws', async () => {
    const { updateSession } = await import('./session');
    await expect(
      updateSession(() => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(sets()).toHaveLength(0);
  });

  it('getLocale uses the session triple, then the cookie, then de-DE', async () => {
    const { getLocale, setSessionCookie } = await import('./session');
    expect(await getLocale()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    jar.values.set('your-shop-country-locale', 'en-US');
    expect(await getLocale()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    await setSessionCookie({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(await getLocale()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  it('getLocale ignores an unsupported cookie value', async () => {
    const { getLocale } = await import('./session');
    jar.values.set('your-shop-country-locale', 'fr-FR');
    expect((await getLocale()).locale).toBe('de-DE');
  });
});

describe('Stateless session: startup', () => {
  it('Weak secret', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', 'w'.repeat(31));
    await expect(import('./session')).rejects.toThrow(/32/);
  });

  it('No fallback key', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', '');
    await expect(import('./session')).rejects.toThrow('SESSION_SECRET');
  });

  it('Under test a weak secret does not stop the import but no token can be made', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    const { createSessionToken } = await import('./session');
    await expect(createSessionToken({})).rejects.toThrow('SESSION_SECRET');
  });
});
