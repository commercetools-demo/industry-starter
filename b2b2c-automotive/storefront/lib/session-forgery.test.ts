// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, C08 (session forgery), C20 (shop-as claims) and G02 (cookie flags): a forged, altered, unsigned, truncated, empty or expired
// session cookie is the empty (signed-out) session, never a customer; claims outside the allow-list never become session fields.
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { SESSION_MAX_AGE, sessionCookieOptions, signSession, verifySession } from '@/lib/session-core';

const SECRET = new TextEncoder().encode('x'.repeat(48));
const GUESS = new TextEncoder().encode('secret'.repeat(8));
const claims = { customerId: 'cust-a', storeKey: 'store-a', distributionChannelId: 'dist-a' };
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('session forgery (C08)', () => {
  it('a valid token verifies', async () => {
    expect(await verifySession(await signSession(claims, SECRET), SECRET)).toMatchObject(claims);
  });
  it('(a) changed claims with the original signature are the empty session', async () => {
    const [h, , sig] = (await signSession(claims, SECRET)).split('.');
    const forged = `${h}.${b64({ ...claims, storeKey: 'store-b', customerId: 'cust-b', iat: 1, exp: 4102444800 })}.${sig}`;
    expect(await verifySession(forged, SECRET)).toEqual({});
  });
  it('(b) alg none is the empty session', async () => {
    expect(await verifySession(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, exp: 4102444800 })}.`, SECRET)).toEqual({});
    expect(await verifySession(`${b64({ alg: 'None' })}.${b64(claims)}.`, SECRET)).toEqual({});
  });
  it('(c) HS256 signed with a guessed secret, and an HS512 token with the right secret, are the empty session', async () => {
    expect(await verifySession(await signSession(claims, GUESS), SECRET)).toEqual({});
    const hs512 = await new SignJWT({ ...claims }).setProtectedHeader({ alg: 'HS512' }).setExpirationTime('1h').sign(SECRET);
    expect(await verifySession(hs512, SECRET)).toEqual({});
  });
  it('(d) truncated, (e) empty and undefined tokens are the empty session', async () => {
    const token = await signSession(claims, SECRET);
    expect(await verifySession(token.slice(0, token.length - 5), SECRET)).toEqual({});
    expect(await verifySession(token.split('.').slice(0, 2).join('.'), SECRET)).toEqual({});
    expect(await verifySession('', SECRET)).toEqual({});
    expect(await verifySession(undefined, SECRET)).toEqual({});
  });
  it('(f) an expired token is the empty session', async () => {
    const expired = await new SignJWT({ ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(1).setExpirationTime(2).sign(SECRET);
    expect(await verifySession(expired, SECRET)).toEqual({});
  });
  it('unknown or wrongly typed claims never become session fields (mass assignment)', async () => {
    const token = await new SignJWT({ ...claims, role: 'admin', isAdmin: true, impImpExp: 'soon', impAbs: -1, impersonatedBy: 42 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(SECRET);
    expect(await verifySession(token, SECRET)).toEqual(claims);
  });
});

describe('session cookie flags (G02)', () => {
  it('HttpOnly, SameSite=Lax, Path=/ and a 30 day lifetime; Secure only in production', () => {
    expect(sessionCookieOptions('development')).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE, secure: false });
    expect(sessionCookieOptions('production')).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE, secure: true });
  });
});
