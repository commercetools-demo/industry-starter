// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { applyBusinessContext, applyLocale, applyStore, pickSession, setCookieHeader, signSession, verifySession } from './session-core';

const secret = new TextEncoder().encode('s'.repeat(48));
const other = new TextEncoder().encode('o'.repeat(48));
const storeA = { storeKey: 'mau-store-north', distributionChannelId: 'd-a', supplyChannelId: 's-a', productSelectionId: 'p-a' };
const storeB = { storeKey: 'mau-store-south', distributionChannelId: 'd-b', supplyChannelId: 's-b', productSelectionId: 'p-b' };
const unitA = { ...storeA, businessUnitKey: 'mau-bu-north', accountGroupIds: ['g1'] };
const unitB = { ...storeB, businessUnitKey: 'mau-bu-south', accountGroupIds: ['g2', 'g3'] };

describe('B2B session: allow-list', () => {
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
  it('pending only survives as the boolean true', () => {
    expect(pickSession({ pending: true })).toEqual({ pending: true });
    expect(pickSession({ pending: 'yes' })).toEqual({});
    expect(pickSession({ pending: false })).toEqual({});
  });
  it('actingAs is kept as a string', () => {
    expect(pickSession({ actingAs: 'Pat Doe' })).toEqual({ actingAs: 'Pat Doe' });
    expect(pickSession({ actingAs: { name: 'x' } })).toEqual({});
  });
  it('accountGroupIds must be an array of strings', () => {
    expect(pickSession({ accountGroupIds: ['a', 'b'] })).toEqual({ accountGroupIds: ['a', 'b'] });
    expect(pickSession({ accountGroupIds: ['a', 2] })).toEqual({});
    expect(pickSession({ accountGroupIds: 'a' })).toEqual({});
    expect(pickSession({ accountGroupIds: Array.from({ length: 51 }, (_, i) => `g${i}`) })).toEqual({});
  });
  it('Extra keys never reach the token', async () => {
    const token = await signSession({ customerId: 'c1', email: 'a@example.com' } as never, secret);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.email).toBeUndefined();
    expect(payload.customerId).toBe('c1');
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 30);
  });
});

describe('B2B session: sign and verify', () => {
  it('Round trip', async () => {
    const s = { customerId: 'c1', cartId: 'cart', locale: 'de-DE' as const, ...unitA };
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

describe('B2B session: locale, currency and country', () => {
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

describe('B2B session: store fields', () => {
  it('Store fields change together', () => {
    expect(applyStore({ customerId: 'c1' }, storeA)).toEqual({ customerId: 'c1', ...storeA });
  });
  it('Store change clears cartId', () => {
    expect(applyStore({ cartId: 'cart', ...storeA }, storeB)).toEqual(storeB);
  });
  it('Same store keeps the cart', () => {
    expect(applyStore({ cartId: 'cart', ...storeA }, storeA).cartId).toBe('cart');
  });
  it('Incomplete store context throws and changes nothing', () => {
    const session = { cartId: 'cart', ...storeA };
    const snapshot = { ...session };
    expect(() => applyStore(session, { ...storeB, supplyChannelId: '' })).toThrow('Incomplete store context');
    expect(session).toEqual(snapshot);
  });
});

describe('B2B session: Switch business unit or store', () => {
  it('Business context fields change together', () => {
    expect(applyBusinessContext({ customerId: 'c1', locale: 'de-DE' }, unitA)).toEqual({ customerId: 'c1', locale: 'de-DE', ...unitA });
  });
  it('Switch business unit or store', () => {
    const before = { customerId: 'c1', cartId: 'cart', ...unitA };
    const after = applyBusinessContext(before, unitB);
    expect(after).toEqual({ customerId: 'c1', ...unitB });
    expect(after.cartId).toBeUndefined();
    expect(before.cartId).toBe('cart');
  });
  it('cartId clears even when only the unit changes', () => {
    expect(applyBusinessContext({ cartId: 'cart', ...unitA }, { ...unitA, businessUnitKey: 'mau-bu-north-2' }).cartId).toBeUndefined();
  });
  it('A reduced pending session becomes a full one', () => {
    expect(applyBusinessContext({ customerId: 'c1', pending: true }, unitA).pending).toBeUndefined();
  });
  it('Incomplete business context throws and changes nothing', () => {
    const session = { cartId: 'cart', ...unitA };
    const snapshot = { ...session };
    for (const broken of [{ businessUnitKey: '' }, { productSelectionId: '' }, { accountGroupIds: undefined as never }, { accountGroupIds: [''] }]) {
      expect(() => applyBusinessContext(session, { ...unitB, ...broken })).toThrow('Incomplete business context');
    }
    expect(session).toEqual(snapshot);
  });
  it('The returned groups are a copy', () => {
    const groups = ['g1'];
    const next = applyBusinessContext({}, { ...unitA, accountGroupIds: groups });
    groups.push('g2');
    expect(next.accountGroupIds).toEqual(['g1']);
  });
});

describe('B2B session: Cookie header', () => {
  it('setCookieHeader replaces an existing cookie', () => {
    expect(setCookieHeader('a=1; malva_portal_session=old; b=2', 'malva_portal_session', 'new')).toBe('a=1; b=2; malva_portal_session=new');
  });
  it('setCookieHeader adds a missing cookie', () => {
    expect(setCookieHeader('a=1', 'malva_portal_session', 'new')).toBe('a=1; malva_portal_session=new');
    expect(setCookieHeader(null, 'malva_portal_session', 'new')).toBe('malva_portal_session=new');
  });
  it('A cookie whose name only starts the same is kept', () => {
    expect(setCookieHeader('malva_portal_session_x=1', 'malva_portal_session', 'n')).toBe('malva_portal_session_x=1; malva_portal_session=n');
  });
});
