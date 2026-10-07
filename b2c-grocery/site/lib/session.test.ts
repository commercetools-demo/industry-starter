// @vitest-environment node
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { clearSessionCookie, createSessionToken, getMarket, getSession, updateSession } from './session';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n) } : undefined) }),
}));

afterEach(() => {
  jar.clear();
  vi.unstubAllEnvs();
});

describe('getSession', () => {
  it('is empty when there is no cookie', async () => {
    expect(await getSession()).toEqual({});
  });

  it('round-trips a token', async () => {
    jar.set('malva-session', await createSessionToken({ cartId: 'c1', country: 'US' }));
    expect(await getSession()).toEqual({ cartId: 'c1', country: 'US' });
  });

  it('Tampered cookie: a modified token yields an empty session', async () => {
    const token = await createSessionToken({ customerId: 'victim' });
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ customerId: 'admin' })).toString('base64url');
    jar.set('malva-session', `${h}.${forged}.${s}`);
    expect(await getSession()).toEqual({});
    expect(p).not.toBe(forged);
  });

  it('an expired token yields an empty session', async () => {
    const secret = new TextEncoder().encode('dev-only-session-secret-0123456789ab');
    vi.stubEnv('SESSION_SECRET', '');
    const expired = await new SignJWT({ cartId: 'c' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(secret);
    jar.set('malva-session', expired);
    expect(await getSession()).toEqual({});
  });
});

describe('secret handling', () => {
  it('Short secret in production throws', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'short');
    await expect(createSessionToken({})).rejects.toThrow('at least 32');
  });
  it('production without a secret throws', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    await expect(createSessionToken({})).rejects.toThrow('at least 32');
  });
});

describe('updateSession and cookie flags', () => {
  it('merges the patch and keeps unrelated fields', async () => {
    jar.set('malva-session', await createSessionToken({ customerId: 'u1', cartId: 'c1' }));
    const res = NextResponse.json({});
    const next = await updateSession({ cartId: 'c2' }, res);
    expect(next).toEqual({ customerId: 'u1', cartId: 'c2' });
  });

  it('lastOrderId (V) survives the cookie round trip; completing an order swaps cartId for lastOrderId', async () => {
    jar.set('malva-session', await createSessionToken({ cartId: 'c1', country: 'US' }));
    const res = NextResponse.json({});
    const next = await updateSession({ lastOrderId: 'o1', cartId: undefined }, res);
    expect(next).toEqual({ lastOrderId: 'o1', country: 'US' });
    jar.set('malva-session', res.cookies.get('malva-session')?.value ?? '');
    expect(await getSession()).toEqual({ lastOrderId: 'o1', country: 'US' });
  });

  it('removes keys patched to undefined', async () => {
    jar.set('malva-session', await createSessionToken({ cartId: 'c1', country: 'US' }));
    const next = await updateSession({ cartId: undefined }, NextResponse.json({}));
    expect(next).toEqual({ country: 'US' });
  });

  it('sets httpOnly, sameSite lax, 30 days, path /; secure only in production', async () => {
    const dev = NextResponse.json({});
    await updateSession({ country: 'US' }, dev);
    const c = dev.cookies.get('malva-session')!;
    expect(c).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
    expect(c.secure).toBeFalsy();

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(32));
    const prod = NextResponse.json({});
    await updateSession({ country: 'US' }, prod);
    expect(prod.cookies.get('malva-session')!.secure).toBe(true);
  });

  it('clearSessionCookie expires the cookie', () => {
    const res = NextResponse.json({});
    clearSessionCookie(res);
    expect(res.cookies.get('malva-session')).toMatchObject({ value: '', maxAge: 0 });
  });
});

describe('getMarket', () => {
  it('uses the session market when complete', async () => {
    jar.set('malva-session', await createSessionToken({ country: 'DE', currency: 'EUR', locale: 'de-DE' }));
    expect(await getMarket()).toEqual({ country: 'DE', currency: 'EUR', locale: 'de-DE' });
  });
  it('falls back to the locale cookie, then the default', async () => {
    jar.set('your-shop-country-locale', 'de-DE');
    expect(await getMarket()).toEqual({ country: 'DE', currency: 'EUR', locale: 'de-DE' });
    jar.clear();
    expect(await getMarket()).toEqual({ country: 'US', currency: 'USD', locale: 'en-US' });
  });
});
