// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { clearCart, clearCustomer, cookieOptions, defaultSession, openSession, pick, sealSession, secretKey, SESSION_FIELDS } from './session-core';

const key = secretKey('x'.repeat(40));

describe('malva-bff-and-session › Server-managed session', () => {
  it('round-trips the allow-listed fields only', async () => {
    const token = await sealSession({ ...defaultSession(), customerId: 'c1', password: 'nope', token: 'nope' } as never, key);
    const s = await openSession(token, key);
    expect(s.customerId).toBe('c1');
    expect(Object.keys(s).every((k) => (SESSION_FIELDS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify(s)).not.toContain('nope');
  });
  it('treats a tampered cookie as an anonymous empty session', async () => {
    const token = await sealSession({ ...defaultSession(), customerId: 'c1' }, key);
    expect(await openSession(token.slice(0, -3) + 'abc', key)).toEqual(defaultSession());
    expect(await openSession('garbage', key)).toEqual(defaultSession());
  });
  it('treats a cookie signed with another key as anonymous', async () => {
    const other = await sealSession({ ...defaultSession(), customerId: 'c1' }, secretKey('y'.repeat(40)));
    expect((await openSession(other, key)).customerId).toBeUndefined();
  });
  it('treats an expired cookie as anonymous', async () => {
    const old = await new SignJWT({ customerId: 'c1' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(key);
    expect((await openSession(old, key)).customerId).toBeUndefined();
  });
  it('uses the locale defaults for an empty session', async () => {
    expect(await openSession(undefined, key, 'de-DE')).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });
  it('pick drops unknown and non-string fields', () => {
    expect(pick({ customerId: 'a', evil: 'x', cartId: 5 })).toEqual({ customerId: 'a' });
  });
});

describe('malva-bff-and-session › Secret strength', () => {
  it('refuses a missing or short secret, with no fallback key', () => {
    expect(() => secretKey(undefined, 'production')).toThrow(/SESSION_SECRET/);
    expect(() => secretKey('short', 'production')).toThrow(/32/);
    expect(() => secretKey('short', 'development')).toThrow(/32/);
  });
  it('allows a short secret only under test', () => {
    expect(() => secretKey('short', 'test')).not.toThrow();
    expect(() => secretKey(undefined, 'test')).toThrow();
  });
});

describe('malva-bff-and-session › cookie attributes and lifecycle', () => {
  it('is HttpOnly, Lax, path=/, 30 days, Secure outside development', () => {
    expect(cookieOptions('production')).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 2592000 });
    expect(cookieOptions('development').secure).toBe(false);
  });
  it('sign-out clears customer, cart and unit but keeps locale and store', () => {
    const s = clearCustomer({ ...defaultSession(), customerId: 'c', customerEmail: 'e', customerFirstName: 'f', customerLastName: 'l', cartId: 'k', businessUnitKey: 'b', storeKey: 'mpw-web' });
    expect(s).toEqual({ ...defaultSession(), storeKey: 'mpw-web' });
  });
  it('placing a request clears only the cart', () => {
    expect(clearCart({ ...defaultSession(), customerId: 'c', cartId: 'k' })).toEqual({ ...defaultSession(), customerId: 'c' });
  });
});

import { initDefaultStore, setBusinessContext, setCart, setCustomer } from './session-core';

const mpw = { storeKey: 'mpw-web', storeId: 's', distributionChannelId: 'd', supplyChannelId: 'u', productSelectionId: 'p' };
describe('malva-business-unit-context › Atomic business-context session fields', () => {
  it('Anonymous session: default store, no business unit', () => {
    const s = initDefaultStore({ ...defaultSession(), businessUnitKey: 'x' }, mpw);
    expect(s).toMatchObject(mpw);
    expect(s.businessUnitKey).toBeUndefined();
  });
  it('Signed-in client: all business-context fields together; old store fields replaced', () => {
    const s = setBusinessContext(initDefaultStore(defaultSession(), mpw), { storeKey: 'o', storeId: 'so', businessUnitKey: 'co' });
    expect(s).toMatchObject({ storeKey: 'o', storeId: 'so', businessUnitKey: 'co' });
    expect(s.distributionChannelId).toBeUndefined();
  });
  it('No partial state: incomplete input throws and the input is unchanged', () => {
    const before = initDefaultStore(defaultSession(), mpw);
    const copy = { ...before };
    expect(() => setBusinessContext(before, { storeKey: 'o', storeId: '', businessUnitKey: 'co' })).toThrow();
    expect(() => setBusinessContext(before, { storeKey: 'o', storeId: 's', businessUnitKey: '' })).toThrow();
    expect(before).toEqual(copy);
  });
  it('setCustomer and setCart validate', () => {
    expect(setCustomer(defaultSession(), { customerId: 'c', customerEmail: 'e@x.co' }).customerId).toBe('c');
    expect(() => setCustomer(defaultSession(), { customerId: '', customerEmail: 'e' })).toThrow();
    expect(setCart(defaultSession(), 'k').cartId).toBe('k');
    expect(() => setCart(defaultSession(), '')).toThrow();
  });
  it('Sign-out keeps locale and default-store fields', () => {
    const s = clearCustomer(setBusinessContext(setCustomer(initDefaultStore(defaultSession(), mpw), { customerId: 'c', customerEmail: 'e' }), { ...mpw, businessUnitKey: 'co' }));
    expect(s).toMatchObject({ ...defaultSession(), ...mpw });
    expect(s.customerId).toBeUndefined();
    expect(s.businessUnitKey).toBeUndefined();
  });
});
