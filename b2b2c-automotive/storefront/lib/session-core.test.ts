// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { applyLocale, applyStore, pickSession, setCookieHeader, signSession, verifySession } from './session-core';

const secret = new TextEncoder().encode('s'.repeat(48));
const other = new TextEncoder().encode('o'.repeat(48));
const storeA = { storeKey: 'mau-store-north', distributionChannelId: 'd-a', supplyChannelId: 's-a', productSelectionId: 'p-a' };
const storeB = { storeKey: 'mau-store-south', distributionChannelId: 'd-b', supplyChannelId: 's-b', productSelectionId: 'p-b' };

describe('Stateless session: allow-list', () => {
  it('Session contents are allow-listed', () => {
    const picked = pickSession({ customerId: 'c1', locale: 'en-US', isAdmin: true, email: 'a@example.com', cartId: 42, storeKey: '', currency: { x: 1 } });
    expect(picked).toEqual({ customerId: 'c1', locale: 'en-US' });
  });
  it('An unsupported locale is dropped', () => {
    expect(pickSession({ locale: 'fr-FR' })).toEqual({});
  });
  it('Non-objects give an empty session', () => {
    expect(pickSession(null)).toEqual({});
    expect(pickSession('x')).toEqual({});
  });
  it('Extra keys never reach the token', async () => {
    const token = await signSession({ customerId: 'c1', email: 'a@example.com' } as never, secret);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.email).toBeUndefined();
    expect(payload.customerId).toBe('c1');
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 30);
  });
});

describe('Stateless session: sign and verify', () => {
  it('Round trip', async () => {
    const s = { customerId: 'c1', cartId: 'cart', locale: 'de-DE' as const, ...storeA };
    expect(await verifySession(await signSession(s, secret), secret)).toEqual(s);
  });
  it('Missing token gives an empty session', async () => {
    expect(await verifySession(undefined, secret)).toEqual({});
  });
  it('Tampered token gives an empty session', async () => {
    const token = await signSession({ customerId: 'c1' }, secret);
    const [h, p, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ customerId: 'someone-else' })).toString('base64url');
    expect(await verifySession(`${h}.${forged}.${sig}`, secret)).toEqual({});
    expect(await verifySession(`${h}.${p}.${sig.slice(0, -2)}xx`, secret)).toEqual({});
    expect(await verifySession('garbage', secret)).toEqual({});
  });
  it('Expired token gives an empty session', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await new SignJWT({ customerId: 'c1' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(past - 10).setExpirationTime(past).sign(secret);
    expect(await verifySession(token, secret)).toEqual({});
  });
  it('Token signed with another secret gives an empty session', async () => {
    expect(await verifySession(await signSession({ customerId: 'c1' }, other), secret)).toEqual({});
  });
  it('alg none is rejected', async () => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ customerId: 'c1', exp: Math.floor(Date.now() / 1000) + 600 })}.`;
    expect(await verifySession(token, secret)).toEqual({});
  });
  it('Another HMAC algorithm is rejected', async () => {
    const token = await new SignJWT({ customerId: 'c1' }).setProtectedHeader({ alg: 'HS512' }).setExpirationTime('1h').sign(secret);
    expect(await verifySession(token, secret)).toEqual({});
  });
});

describe('Stateless session: locale, currency and country', () => {
  it('Locale triple changes together', () => {
    expect(applyLocale({ customerId: 'c1' }, 'en-US')).toEqual({ customerId: 'c1', locale: 'en-US', currency: 'USD', country: 'US' });
  });
  it('cartId resets when currency changes', () => {
    const s = applyLocale({ cartId: 'cart', locale: 'de-DE', currency: 'EUR', country: 'DE' }, 'en-US');
    expect(s.cartId).toBeUndefined();
    expect(s.currency).toBe('USD');
  });
  it('cartId survives a locale change with the same currency', () => {
    const s = applyLocale({ cartId: 'cart', locale: 'de-DE', currency: 'EUR', country: 'DE' }, 'de-DE');
    expect(s.cartId).toBe('cart');
  });
  it('Does not mutate its input', () => {
    const input = { cartId: 'cart', currency: 'EUR' };
    applyLocale(input, 'en-US');
    expect(input).toEqual({ cartId: 'cart', currency: 'EUR' });
  });
});

describe('Store resolved from the path: session half', () => {
  it('Store fields change together', () => {
    expect(applyStore({ customerId: 'c1' }, storeA)).toEqual({ customerId: 'c1', ...storeA });
  });
  it('Store change clears cartId', () => {
    const s = applyStore({ cartId: 'cart', ...storeA }, storeB);
    expect(s).toEqual(storeB);
  });
  it('store change clears branchKey and cartId', () => {
    const s = applyStore({ cartId: 'cart', branchKey: 'mau-br-north-hamburg', ...storeA }, storeB);
    expect(s).toEqual(storeB);
    expect(applyStore({ branchKey: 'b', ...storeA }, storeA).branchKey).toBe('b');
  });
  it('branchKey survives a locale change', () => {
    expect(applyLocale({ branchKey: 'mau-br-north-hamburg', currency: 'EUR', locale: 'de-DE', country: 'DE' }, 'en-US').branchKey).toBe('mau-br-north-hamburg');
  });
  it('branchKey is allow-listed in the session', () => {
    expect(pickSession({ branchKey: 'b1', other: 'x' })).toEqual({ branchKey: 'b1' });
  });
  it('Same store keeps the cart', () => {
    expect(applyStore({ cartId: 'cart', ...storeA }, storeA).cartId).toBe('cart');
  });
  it('Incomplete store context throws and changes nothing', () => {
    const session = { cartId: 'cart', ...storeA };
    const snapshot = { ...session };
    expect(() => applyStore(session, { ...storeB, supplyChannelId: '' })).toThrow('Incomplete store context');
    expect(() => applyStore(session, { ...storeB, productSelectionId: undefined as never })).toThrow('Incomplete store context');
    expect(session).toEqual(snapshot);
  });
});

describe('Stateless session: Cookie header', () => {
  it('setCookieHeader replaces an existing cookie', () => {
    expect(setCookieHeader('a=1; malva_session=old; b=2', 'malva_session', 'new')).toBe('a=1; b=2; malva_session=new');
  });
  it('setCookieHeader adds a missing cookie', () => {
    expect(setCookieHeader('a=1', 'malva_session', 'new')).toBe('a=1; malva_session=new');
    expect(setCookieHeader(null, 'malva_session', 'new')).toBe('malva_session=new');
  });
  it('A cookie whose name only starts the same is kept', () => {
    expect(setCookieHeader('malva_session_x=1', 'malva_session', 'n')).toBe('malva_session_x=1; malva_session=n');
  });
});
