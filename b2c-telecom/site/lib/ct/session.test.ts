// @vitest-environment node
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import {
  clearSessionCookie,
  createSessionToken,
  getSession,
  SESSION_COOKIE,
  SESSION_FIELDS,
  SESSION_MAX_AGE_SECONDS,
  setSessionCookie,
  updateSession,
} from './session';

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'malva-session' && jar.value !== undefined ? { name, value: jar.value } : undefined),
  }),
}));

const SECRET = 'unit-test-session-secret-0123456789-abcdef';

beforeEach(() => {
  jar.value = undefined;
  vi.stubEnv('SESSION_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function setCookieHeader(res: NextResponse): string {
  return res.headers.get('set-cookie') ?? '';
}

describe('getSession', () => {
  it('returns an empty object when there is no cookie', async () => {
    expect(await getSession()).toEqual({});
  });

  it('round-trips a signed token', async () => {
    jar.value = await createSessionToken({ customerId: 'c1', cartId: 'cart1', locale: 'en-US' });
    expect(await getSession()).toEqual({ customerId: 'c1', cartId: 'cart1', locale: 'en-US' });
  });

  it('returns {} for a tampered token', async () => {
    const token = await createSessionToken({ customerId: 'c1' });
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ customerId: 'admin' })).toString('base64url');
    expect(p).not.toBe(forged);
    jar.value = `${h}.${forged}.${s}`;
    expect(await getSession()).toEqual({});
  });

  it('returns {} for an expired token', async () => {
    jar.value = await new SignJWT({ customerId: 'c1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    expect(await getSession()).toEqual({});
  });

  it('returns {} for an alg none token', async () => {
    const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    jar.value = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ customerId: 'c1', exp })}.`;
    expect(await getSession()).toEqual({});
  });

  it('returns {} for a token signed with another secret', async () => {
    jar.value = await createSessionToken({ customerId: 'c1' });
    vi.stubEnv('SESSION_SECRET', 'another-secret-another-secret-0123456789');
    expect(await getSession()).toEqual({});
  });
});

describe('createSessionToken', () => {
  it('Session carries no commercetools credential: only whitelisted reference fields are signed, the cookie is HttpOnly and tamper-proof', async () => {
    const token = await createSessionToken({ customerId: 'c1', accessToken: 'x', password: 'p' } as never);
    const payload = decodeJwt(token);
    expect(payload).not.toHaveProperty('accessToken');
    expect(payload).not.toHaveProperty('password');
    expect(payload.customerId).toBe('c1');
    const allowed = new Set<string>([...SESSION_FIELDS, 'iat', 'exp']);
    for (const key of Object.keys(payload)) expect(allowed.has(key), key).toBe(true);
    expect(decodeProtectedHeader(token).alg).toBe('HS256');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(SESSION_MAX_AGE_SECONDS);

    const res = NextResponse.json({});
    setSessionCookie(res, token);
    expect(setCookieHeader(res)).toContain('HttpOnly');

    const [h, , s] = token.split('.');
    jar.value = `${h}.${Buffer.from(JSON.stringify({ customerId: 'other' })).toString('base64url')}.${s}`;
    expect(await getSession()).toEqual({});
  });

  it('drops undefined fields', async () => {
    const payload = decodeJwt(await createSessionToken({ customerId: undefined, cartId: 'k' }));
    expect(Object.keys(payload).sort()).toEqual(['cartId', 'exp', 'iat']);
  });
});

describe('cookie attributes', () => {
  it('sets HttpOnly, SameSite=Lax, Path=/, Max-Age=2592000 and no Secure outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = NextResponse.json({});
    setSessionCookie(res, 'tok');
    const header = setCookieHeader(res);
    expect(header).toContain(`${SESSION_COOKIE}=tok`);
    expect(header).toContain('HttpOnly');
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=2592000');
    expect(header).not.toMatch(/Secure/i);
  });

  it('adds Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = NextResponse.json({});
    setSessionCookie(res, 'tok');
    expect(setCookieHeader(res)).toMatch(/Secure/i);
  });

  it('clearSessionCookie expires the cookie', () => {
    const res = NextResponse.json({});
    clearSessionCookie(res);
    expect(setCookieHeader(res)).toContain('Max-Age=0');
  });
});

describe('updateSession', () => {
  it('merges, keeps unrelated fields and deletes a field patched to undefined', async () => {
    jar.value = await createSessionToken({ anonymousId: 'a1', cartId: 'cart1', locale: 'en-US' });
    const res = NextResponse.json({});
    const merged = await updateSession({ customerId: 'c1', anonymousId: undefined }, res);
    expect(merged).toEqual({ cartId: 'cart1', locale: 'en-US', customerId: 'c1' });
    const cookie = /malva-session=([^;]+)/.exec(setCookieHeader(res))?.[1] ?? '';
    const payload = decodeJwt(cookie);
    expect(payload.customerId).toBe('c1');
    expect(payload.cartId).toBe('cart1');
    expect(payload).not.toHaveProperty('anonymousId');
  });
});

describe('secret handling', () => {
  it('Session secret too weak: the session module refuses to sign with it', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(31));
    await expect(createSessionToken({ customerId: 'c1' })).rejects.toThrow('SESSION_SECRET must be at least 32 characters');
  });

  it('throws when the secret is unset outside NODE_ENV=test', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    await expect(createSessionToken({})).rejects.toThrow('Missing environment variable: SESSION_SECRET');
  });

  it('uses the test-only constant when unset in NODE_ENV=test', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    jar.value = await createSessionToken({ customerId: 'c1' });
    expect(await getSession()).toEqual({ customerId: 'c1' });
  });
});
