// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, C08 (session forgery) and G02 (cookie flags): a forged, altered, unsigned, truncated, empty or expired session cookie is
// the empty (signed-out) session, never a customer. Also proves that sign-in builds a FRESH session instead of extending the old
// one (session fixation), and that the cookie carries HttpOnly, SameSite=Lax, Path=/ and Secure in production.
import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_MAX_AGE, signSession, verifySession } from '@/lib/session-core';

const writes = vi.hoisted(() => ({ apply: (patch: (s: Record<string, unknown>) => unknown): void => void patch }));
vi.mock('@/lib/portal/seam', () => ({ writeSession: async (patch: (s: Record<string, unknown>) => unknown) => writes.apply(patch), readSession: async () => ({}) }));

const jar = vi.hoisted(() => ({ calls: [] as { name: string; value: string; options: Record<string, unknown> }[] }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => jar.calls.push({ name, value, options }),
    delete: () => undefined,
  }),
}));

const SECRET = new TextEncoder().encode('x'.repeat(48));
const GUESS = new TextEncoder().encode('secret'.repeat(8));
const claims = { customerId: 'cust-admin-a', businessUnitKey: 'bu-a', storeKey: 'store-a' };
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('session forgery (C08)', () => {
  it('a valid token verifies', async () => {
    expect(await verifySession(await signSession(claims, SECRET), SECRET)).toMatchObject(claims);
  });
  it('(a) changed claims with the original signature are the empty session', async () => {
    const [h, , sig] = (await signSession(claims, SECRET)).split('.');
    const forged = `${h}.${b64({ ...claims, storeKey: 'store-b', customerId: 'cust-admin-b', iat: 1, exp: 4102444800 })}.${sig}`;
    expect(await verifySession(forged, SECRET)).toEqual({});
  });
  it('(b) alg none is the empty session', async () => {
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, exp: 4102444800 })}.`;
    expect(await verifySession(unsigned, SECRET)).toEqual({});
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
    expect(await verifySession('not-a-jwt', SECRET)).toEqual({});
  });
  it('(f) an expired token is the empty session', async () => {
    const expired = await new SignJWT({ ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(1).setExpirationTime(2).sign(SECRET);
    expect(await verifySession(expired, SECRET)).toEqual({});
  });
  it('unknown or wrongly typed claims never become session fields (mass assignment)', async () => {
    const token = await new SignJWT({ ...claims, role: 'admin', isAdmin: true, accountGroupIds: 'x', pending: 'true', actingAs: { x: 1 } }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(SECRET);
    const session = await verifySession(token, SECRET);
    expect(session).toEqual(claims);
  });
  it('the cookie lives for 30 days at most', () => {
    expect(SESSION_MAX_AGE).toBe(60 * 60 * 24 * 30);
  });
});

describe('session fixation', () => {
  it('sign-in writes a FRESH session: nothing of the session that existed before sign-in (cart, acting-as, pending, store) survives', async () => {
    const before = { customerId: 'cust-planted', cartId: 'cart-planted', actingAs: 'cust-x', pending: true as const, storeKey: 'store-b', businessUnitKey: 'bu-b' };
    let after: Record<string, unknown> | undefined;
    // The patch is applied to the OLD session exactly as the seam does; a patch that spread it would keep the planted fields.
    writes.apply = (patch) => {
      after = patch(before) as Record<string, unknown>;
    };
    const { startSession } = await import('@/lib/portal/auth-session');
    const res = await startSession({ kind: 'ok', customerId: 'cust-admin-a', context: { businessUnitKey: 'bu-a', storeKey: 'store-a', distributionChannelId: 'd', supplyChannelId: 's', productSelectionId: 'p', accountGroupIds: [] } }, new Request('http://localhost:3001/api/auth/login', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(after).toMatchObject({ customerId: 'cust-admin-a', businessUnitKey: 'bu-a', storeKey: 'store-a' });
    for (const planted of ['cartId', 'actingAs', 'pending']) expect(after, planted).not.toHaveProperty(planted);
  });
  it('a pending sign-in writes the reduced session only', async () => {
    let after: Record<string, unknown> | undefined;
    writes.apply = (patch) => {
      after = patch({ customerId: 'old', storeKey: 'store-b', cartId: 'c' }) as Record<string, unknown>;
    };
    const { startSession } = await import('@/lib/portal/auth-session');
    await startSession({ kind: 'pending', customerId: 'cust-new' }, new Request('http://localhost:3001/api/auth/login', { method: 'POST' }));
    expect(after).toEqual({ customerId: 'cust-new', pending: true });
  });
  it('a failed sign-in writes nothing', async () => {
    writes.apply = () => {
      throw new Error('must not write');
    };
    const { startSession } = await import('@/lib/portal/auth-session');
    expect((await startSession({ kind: 'invalid' }, new Request('http://localhost:3001/api/auth/login', { method: 'POST' }))).status).toBe(401);
  });
});

describe('session cookie flags (G02)', () => {
  it('HttpOnly, SameSite=Lax, Path=/ and a 30 day lifetime; Secure only in production', async () => {
    const { setSessionCookie, SESSION_COOKIE } = await import('@/lib/session');
    jar.calls.length = 0;
    vi.stubEnv('NODE_ENV', 'development');
    await setSessionCookie({ customerId: 'c' });
    vi.stubEnv('NODE_ENV', 'production');
    await setSessionCookie({ customerId: 'c' });
    vi.unstubAllEnvs();
    expect(jar.calls.map((c) => c.name)).toEqual([SESSION_COOKIE, SESSION_COOKIE]);
    for (const { options } of jar.calls) expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE });
    expect(jar.calls[0].options.secure).toBe(false);
    expect(jar.calls[1].options.secure).toBe(true);
  });
});
