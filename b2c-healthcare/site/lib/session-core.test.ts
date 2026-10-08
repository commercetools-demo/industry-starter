// @vitest-environment node
import { decodeJwt, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  pickSession,
  resolveSecret,
  sessionCookieOptions,
  signSession,
  verifySession,
  withCart,
  withCustomer,
  withLocale,
  withRegion,
  withoutCart,
  withoutCustomer,
} from './session-core';

const SECRET = 'unit-test-secret-that-is-long-enough-123456';
const full = { customerId: 'c1', cartId: 'k1', country: 'US', currency: 'USD', locale: 'en-US' };

describe('storefront-bff-and-session: Server-managed session in an opaque cookie', () => {
  it('Session contents: payload has only the five allowed fields', async () => {
    const token = await signSession(
      { ...full, email: 'a@b.c', name: 'Pat', dob: '1990-01-01', rx: 'RX1' } as Record<string, string>,
      SECRET,
    );
    const { iat, exp, ...claims } = decodeJwt(token);
    expect(iat).toBeTypeOf('number');
    expect(exp).toBeTypeOf('number');
    expect(claims).toEqual(full);
    expect(await verifySession(token, SECRET)).toEqual(full);
  });

  it('Session contents: pickSession drops unknown keys and non-strings', () => {
    expect(pickSession({ customerId: 5, cartId: 'x', email: 'e', locale: '' })).toEqual({ cartId: 'x' });
    expect(pickSession(null)).toEqual({});
  });

  it('Tampered or expired cookie: tampered token gives an empty session, no throw', async () => {
    const token = await signSession(full, SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect(await verifySession(tampered, SECRET)).toEqual({});
    expect(await verifySession(token, 'a-different-secret-that-is-long-enough-xx')).toEqual({});
    expect(await verifySession('garbage', SECRET)).toEqual({});
    expect(await verifySession(undefined, SECRET)).toEqual({});
  });

  it('Tampered or expired cookie: expired token gives an empty session', async () => {
    const expired = await new SignJWT({ customerId: 'c1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired, SECRET)).toEqual({});
  });

  it('Tampered or expired cookie: a token signed with another algorithm or alg none is rejected', async () => {
    const forged = await new SignJWT({ customerId: 'c1' })
      .setProtectedHeader({ alg: 'HS512' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(forged, SECRET)).toEqual({});
    const none = `${btoa('{"alg":"none"}')}.${btoa('{"customerId":"c1"}')}.`;
    expect(await verifySession(none, SECRET)).toEqual({});
  });

  it('Tampered or expired cookie: token lifetime is 30 days', async () => {
    const { iat, exp } = decodeJwt(await signSession(full, SECRET));
    expect((exp as number) - (iat as number)).toBe(SESSION_MAX_AGE_SECONDS);
    expect(SESSION_MAX_AGE_SECONDS).toBe(2592000);
  });

  it('Secret strength: missing or short secret throws outside test; no fallback', () => {
    expect(() => resolveSecret(undefined, 'production')).toThrow('SESSION_SECRET');
    expect(() => resolveSecret('short', 'development')).toThrow('SESSION_SECRET');
    expect(() => resolveSecret('x'.repeat(31), undefined)).toThrow('SESSION_SECRET');
    expect(resolveSecret('x'.repeat(32), 'production')).toBe('x'.repeat(32));
  });

  it('Secret strength: only NODE_ENV=test may run without a secret', () => {
    expect(resolveSecret(undefined, 'test').length).toBeGreaterThanOrEqual(32);
  });

  it('Not readable by scripts: cookie is HttpOnly, SameSite=Lax, path=/, 30 days', () => {
    expect(SESSION_COOKIE).toBe('malva_session');
    expect(sessionCookieOptions('production')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 2592000,
    });
  });

  it('Not readable by scripts: Secure everywhere except local development', () => {
    expect(sessionCookieOptions('development').secure).toBe(false);
    expect(sessionCookieOptions('production').secure).toBe(true);
    expect(sessionCookieOptions('test').secure).toBe(true);
  });
});

describe('storefront-bff-and-session: Session lifecycle fields', () => {
  it('Sign-out: customerId and cartId are removed and the locale fields remain', () => {
    expect(withoutCustomer(full)).toEqual({ country: 'US', currency: 'USD', locale: 'en-US' });
  });

  it('Sign-in writes customerId; cart creation writes cartId; order clears only cartId', () => {
    const s = withCart(withCustomer({ locale: 'en-US' }, 'c1'), 'k1');
    expect(s).toEqual({ locale: 'en-US', customerId: 'c1', cartId: 'k1' });
    expect(withoutCart(s)).toEqual({ locale: 'en-US', customerId: 'c1' });
  });

  it('setLocale placeholder updates locale, country and currency together', () => {
    expect(withLocale({ customerId: 'c1' }, { locale: 'en-US', country: 'US', currency: 'USD' })).toEqual({
      customerId: 'c1',
      locale: 'en-US',
      country: 'US',
      currency: 'USD',
    });
  });

  it('Partial update rejected / Handing off the cart conflict: withRegion writes all three from COUNTRY_CONFIG', () => {
    expect(withRegion({ customerId: 'c1', cartId: 'k1', currency: 'USD' }, 'en-US')).toEqual({
      customerId: 'c1',
      cartId: 'k1',
      locale: 'en-US',
      country: 'US',
      currency: 'USD',
    });
  });

  it('Handing off the cart conflict: a currency change clears cartId', () => {
    expect(withRegion({ cartId: 'k1', currency: 'EUR', country: 'DE', locale: 'de-DE' }, 'en-US')).toEqual({
      locale: 'en-US',
      country: 'US',
      currency: 'USD',
    });
    expect(withRegion({ cartId: 'k1' }, 'en-US').cartId).toBeUndefined();
  });

  it('withRegion rejects an unsupported locale', () => {
    expect(() => withRegion({}, 'xx-XX')).toThrow(/Unsupported/);
  });
});
