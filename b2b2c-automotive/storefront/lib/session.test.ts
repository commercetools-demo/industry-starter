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

describe('Shop as customer: idle expiry in getSession (V-06)', () => {
  const T0 = new Date('2026-10-12T10:00:00.000Z');
  const sessionAt = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
  const start = async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { setSessionCookie } = await import('./session');
    const { startImpersonation } = await import('./impersonation/state');
    await setSessionCookie(startImpersonation({ storeKey: 'mau-reseller-north', anonymousId: 'anon-1' }, { customerId: 'cust-1', actorId: 'seller-1', jti: 'jti-1' }, T0));
    jar.sets.length = 0;
  };
  afterEach(() => vi.useRealTimers());

  it('idle 121 s ends the session: no customer, no actor, the store stays', async () => {
    await start();
    const { getSession } = await import('./session');
    vi.setSystemTime(sessionAt(121));
    expect(await getSession()).toEqual({ storeKey: 'mau-reseller-north', anonymousId: 'anon-1' });
  });
  it('activity within 120 s extends the deadline and writes the cookie again', async () => {
    await start();
    const { getSession } = await import('./session');
    vi.setSystemTime(sessionAt(100));
    expect(await getSession()).toMatchObject({ customerId: 'cust-1', impersonatedBy: 'seller-1' });
    expect(sets()).toHaveLength(1);
    vi.setSystemTime(sessionAt(200));
    expect(await getSession()).toMatchObject({ customerId: 'cust-1' });
    vi.setSystemTime(sessionAt(321));
    expect(await getSession()).not.toHaveProperty('customerId');
  });
  it('the 30 minute absolute cap holds against steady activity', async () => {
    await start();
    const { getSession } = await import('./session');
    for (let t = 100; t <= 1700; t += 100) {
      vi.setSystemTime(sessionAt(t));
      expect(await getSession(), `t=${t}`).toMatchObject({ customerId: 'cust-1' });
    }
    vi.setSystemTime(sessionAt(1801));
    expect(await getSession()).not.toHaveProperty('customerId');
  });
  it('a normal session never writes a cookie on read', async () => {
    const { setSessionCookie, getSession } = await import('./session');
    await setSessionCookie({ customerId: 'c1' });
    jar.sets.length = 0;
    await getSession();
    expect(sets()).toHaveLength(0);
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
