// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory cookie jar standing in for next/headers.
const jar = new Map<string, string>();
const setSpy = vi.fn((name: string, value: string, options: unknown) => {
  jar.set(name, value);
  return options;
});
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: setSpy,
  }),
}));

import { SESSION_COOKIE } from './session-core';
import { clearCart, clearCustomer, getSession, setCart, setCustomer, setLocale, updateSession } from './session';

describe('storefront-bff-and-session: session helpers over the cookie store', () => {
  beforeEach(() => {
    jar.clear();
    setSpy.mockClear();
  });

  it('no cookie: anonymous empty session', async () => {
    expect(await getSession()).toEqual({});
  });

  it('Tampered or expired cookie: a corrupt cookie reads as empty without throwing', async () => {
    jar.set(SESSION_COOKIE, 'not-a-token');
    expect(await getSession()).toEqual({});
  });

  it('Session contents: updateSession ignores unknown keys and writes the cookie with the flags', async () => {
    await updateSession({ locale: 'en-US', email: 'x@y.z' } as never);
    expect(await getSession()).toEqual({ locale: 'en-US' });
    const options = setSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
  });

  it('Sign-out: clearCustomer drops customerId and cartId, keeps locale', async () => {
    await setLocale({ locale: 'en-US', country: 'US', currency: 'USD' });
    await setCustomer('c1');
    await setCart('k1');
    expect(await getSession()).toMatchObject({ customerId: 'c1', cartId: 'k1', locale: 'en-US' });
    await clearCustomer();
    expect(await getSession()).toEqual({ locale: 'en-US', country: 'US', currency: 'USD' });
  });

  it('order placed: clearCart drops only cartId', async () => {
    await setCustomer('c1');
    await setCart('k1');
    await clearCart();
    expect(await getSession()).toEqual({ customerId: 'c1' });
  });
});
