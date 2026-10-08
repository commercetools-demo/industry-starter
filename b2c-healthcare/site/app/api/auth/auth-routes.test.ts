// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeJsonRequest } from '@/test/request';

const identity = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCustomerById: vi.fn(),
  changePassword: vi.fn(),
};
vi.mock('@/lib/ct/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/identity')>()),
  login: (a: unknown) => identity.login(a),
  register: (a: unknown) => identity.register(a),
  logout: () => identity.logout(),
  getCustomerById: (a: unknown) => identity.getCustomerById(a),
  changePassword: (...a: unknown[]) => identity.changePassword(...a),
}));
const attachAfterSignIn = vi.fn();
vi.mock('@/lib/attach-guest-bookings', () => ({ attachAfterSignIn: (u: unknown) => attachAfterSignIn(u) }));
const getSession = vi.fn();
const updateSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession(), updateSession: (p: unknown) => updateSession(p) }));

import { EmailUnavailableError, InvalidCredentialsError, TooManyAttemptsError, ValidationError, WrongCurrentPasswordError } from '@/lib/ct/identity';
import { POST as changePassword } from '@/app/api/account/password/route';
import { POST as loginRoute } from './login/route';
import { POST as logoutRoute } from './logout/route';
import { GET as meRoute } from './me/route';
import { POST as registerRoute } from './register/route';

const sam = { id: 'c1', email: 'sam@example.com', firstName: 'Sam', lastName: 'Rivera', isEmailVerified: true };
const loginBody = { email: 'sam@example.com', password: 'secret-pass-123' };

beforeEach(() => {
  for (const fn of Object.values(identity)) fn.mockReset();
  attachAfterSignIn.mockReset().mockResolvedValue(undefined);
  getSession.mockReset().mockResolvedValue({});
  updateSession.mockReset().mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('account-sign-in: Credentials accepted', () => {
  it('writes customerId and the returned cart to the session and returns the minimal user', async () => {
    identity.login.mockResolvedValue({ user: sam, cartId: 'cart-1' });
    const response = await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
    expect(updateSession).toHaveBeenCalledExactlyOnceWith({ customerId: 'c1', cartId: 'cart-1' });
  });

  it('the response carries no password, token or verification flag', async () => {
    identity.login.mockResolvedValue({ user: sam });
    const text = await (await loginRoute(makeJsonRequest('/api/auth/login', loginBody))).text();
    expect(text).not.toMatch(/password|token|isEmailVerified/i);
  });

  it('missing fields: 400 with field problems, commercetools not called', async () => {
    const response = await loginRoute(makeJsonRequest('/api/auth/login', { email: '', password: '' }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual({ email: 'required', password: 'required' });
    expect(identity.login).not.toHaveBeenCalled();
  });
});

describe('authentication-and-identity: Sign in carries the anonymous cart', () => {
  it('passes the session cart id to the sign-in and stores the cart that comes back', async () => {
    getSession.mockResolvedValue({ cartId: 'cart-anon', locale: 'en-US' });
    identity.login.mockResolvedValue({ user: sam, cartId: 'cart-merged' });
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(identity.login).toHaveBeenCalledWith(expect.objectContaining({ anonymousCartId: 'cart-anon' }));
    expect(updateSession).toHaveBeenCalledWith({ customerId: 'c1', cartId: 'cart-merged' });
  });

  it('without a session cart nothing is passed', async () => {
    identity.login.mockResolvedValue({ user: sam });
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(identity.login).toHaveBeenCalledWith(expect.objectContaining({ anonymousCartId: undefined }));
    expect(updateSession).toHaveBeenCalledWith({ customerId: 'c1', cartId: undefined });
  });

  it('a stale anonymous cart that did not come back is dropped from the session', async () => {
    getSession.mockResolvedValue({ cartId: 'cart-stale' });
    identity.login.mockResolvedValue({ user: sam });
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(updateSession).toHaveBeenCalledWith({ customerId: 'c1', cartId: undefined });
  });
});

describe('authentication-and-identity: Failed sign in is ambiguous', () => {
  it('unknown email and wrong password produce byte-identical responses', async () => {
    identity.login.mockRejectedValue(new InvalidCredentialsError());
    const unknown = await loginRoute(makeJsonRequest('/api/auth/login', { email: 'nobody@example.com', password: 'whatever-1' }));
    const wrong = await loginRoute(makeJsonRequest('/api/auth/login', { email: 'sam@example.com', password: 'wrong-pass-1' }));
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.text()).toBe(await wrong.text());
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('the refusal text does not echo the email or hint at which part failed', async () => {
    identity.login.mockRejectedValue(new InvalidCredentialsError());
    const text = await (await loginRoute(makeJsonRequest('/api/auth/login', { email: 'nobody@example.com', password: 'whatever-1' }))).text();
    expect(text).not.toContain('nobody');
    expect(text).not.toMatch(/not registered|no account|unknown|incorrect password|wrong password/i);
  });

  it('other failures are sanitized: no raw message leaks', async () => {
    identity.login.mockRejectedValue(Object.assign(new Error('boom sam@example.com secret-pass-123'), { statusCode: 500 }));
    await expectSanitizedError(loginRoute, ['secret-pass-123', 'sam@example.com'], makeJsonRequest('/api/auth/login', loginBody));
  });
});

describe('account-sign-in: attempt limit', () => {
  it('lockout answers 429 with Retry-After and identical text, naming no account', async () => {
    identity.login.mockRejectedValue(new TooManyAttemptsError(420));
    const a = await loginRoute(makeJsonRequest('/api/auth/login', { email: 'sam@example.com', password: 'x-password-1' }));
    const b = await loginRoute(makeJsonRequest('/api/auth/login', { email: 'nobody@example.com', password: 'x-password-1' }));
    expect(a.status).toBe(429);
    expect(a.headers.get('retry-after')).toBe('420');
    const text = await a.text();
    expect(text).toBe(await b.text());
    expect(text).toContain('7 minutes');
    expect(text).not.toMatch(/sam|nobody|exist|registered/i);
  });

  it('the client address from the platform header reaches the bucket', async () => {
    identity.login.mockResolvedValue({ user: sam });
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody, { headers: { 'x-nf-client-connection-ip': '203.0.113.9' } }));
    expect(identity.login).toHaveBeenCalledWith(expect.objectContaining({ clientKey: '203.0.113.9' }));
  });
});

describe('account-registration-request: Request recorded not active', () => {
  const body = { name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' };

  it('201, signed in at once, flagged verified, session carries ids only', async () => {
    identity.register.mockResolvedValue({ user: sam, cartId: 'cart-1', emailVerified: true });
    const response = await registerRoute(makeJsonRequest('/api/auth/register', body));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 'c1', emailVerified: true, firstName: 'Sam' });
    expect(updateSession).toHaveBeenCalledExactlyOnceWith({ customerId: 'c1', cartId: 'cart-1' });
  });

  it('validation problems come back per field as 400', async () => {
    identity.register.mockRejectedValue(new ValidationError({ password: 'tooShort', email: 'invalid' }));
    const response = await registerRoute(makeJsonRequest('/api/auth/register', { ...body, password: 'short' }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual({ password: 'tooShort', email: 'invalid' });
    expect(updateSession).not.toHaveBeenCalled();
  });
});

describe('account-registration-request: Address already registered', () => {
  it('refused with a generic text that does not confirm the address, and nothing is written to the session', async () => {
    identity.register.mockRejectedValue(new EmailUnavailableError());
    const response = await registerRoute(makeJsonRequest('/api/auth/register', { name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' }));
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).not.toContain('sam@example.com');
    expect(text).not.toMatch(/already (registered|exists|in use|taken)|is registered/i);
    expect(text).toMatch(/sign in/i);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('too many attempts: 429', async () => {
    identity.register.mockRejectedValue(new TooManyAttemptsError(60));
    expect((await registerRoute(makeJsonRequest('/api/auth/register', { name: 'A', email: 'a@example.com', password: 'a-long-passphrase' }))).status).toBe(429);
  });
});

describe('authentication-and-identity: session lifecycle', () => {
  it('logout clears the session through identity.logout', async () => {
    identity.logout.mockResolvedValue(undefined);
    const response = await logoutRoute();
    expect(response.status).toBe(200);
    expect(identity.logout).toHaveBeenCalledTimes(1);
  });

  it('me: signed out answers null (200), no commercetools call', async () => {
    const response = await meRoute();
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(identity.getCustomerById).not.toHaveBeenCalled();
  });

  it('me: signed in answers id, names and email only', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    identity.getCustomerById.mockResolvedValue(sam);
    expect(await (await meRoute()).json()).toEqual({ id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' });
  });

  it('me: a session for a deleted customer is signed out and answers null', async () => {
    getSession.mockResolvedValue({ customerId: 'gone' });
    identity.getCustomerById.mockResolvedValue(null);
    expect(await (await meRoute()).json()).toBeNull();
    expect(identity.logout).toHaveBeenCalledTimes(1);
  });
});

describe('authentication-and-identity: change password', () => {
  const request = (body: unknown) => makeJsonRequest('/api/account/password', body);

  it('requires a signed-in customer and calls nothing otherwise', async () => {
    await expectUnauthenticated(changePassword, [identity.changePassword], request({ currentPassword: 'a', newPassword: 'b' }));
  });

  it('changes the password for the session customer', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    identity.changePassword.mockResolvedValue(undefined);
    const response = await changePassword(request({ currentPassword: 'old-password-1', newPassword: 'new-password-12' }));
    expect(response.status).toBe(200);
    expect(identity.changePassword).toHaveBeenCalledWith('c1', 'old-password-1', 'new-password-12');
  });

  it('a wrong current password is 400 with its own text; a weak new one is a field error', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    identity.changePassword.mockRejectedValueOnce(new WrongCurrentPasswordError());
    const wrong = await changePassword(request({ currentPassword: 'nope', newPassword: 'new-password-12' }));
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toMatch(/current password/i);
    identity.changePassword.mockRejectedValueOnce(new ValidationError({ password: 'tooShort' }));
    const weak = await changePassword(request({ currentPassword: 'old-password-1', newPassword: 'short' }));
    expect((await weak.json()).fields).toEqual({ newPassword: 'tooShort' });
  });

  it('a missing current password never reaches identity', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    expect((await changePassword(request({ newPassword: 'new-password-12' }))).status).toBe(400);
    expect(identity.changePassword).not.toHaveBeenCalled();
  });
});

describe('password reset is intentionally absent (D-032)', () => {
  it('no reset route exists under app/api', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? [full, ...walk(full)] : [full];
      });
    const paths = walk(join(process.cwd(), 'app')).filter((p) => /reset|forgot/i.test(p));
    expect(paths).toEqual([]);
  });
});

describe('design-account-area: guest bookings attach after sign-in (R-07 hook)', () => {
  it('login passes the customer, the email and its verified flag to the hook', async () => {
    identity.login.mockResolvedValue({ user: sam, cartId: 'cart-1' });
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(attachAfterSignIn).toHaveBeenCalledExactlyOnceWith({ customerId: 'c1', email: 'sam@example.com', emailVerified: true });
  });

  it('a failed sign-in attaches nothing', async () => {
    identity.login.mockRejectedValue(new InvalidCredentialsError());
    await loginRoute(makeJsonRequest('/api/auth/login', loginBody));
    expect(attachAfterSignIn).not.toHaveBeenCalled();
  });

  it('registration passes the verification outcome of the new account', async () => {
    identity.register.mockResolvedValue({ user: { ...sam, isEmailVerified: false }, cartId: undefined, emailVerified: false });
    await registerRoute(makeJsonRequest('/api/auth/register', { name: 'Sam Rivera', email: 'sam@example.com', password: 'secret-pass-123' }));
    expect(attachAfterSignIn).toHaveBeenCalledExactlyOnceWith({ customerId: 'c1', email: 'sam@example.com', emailVerified: false });
  });
});
