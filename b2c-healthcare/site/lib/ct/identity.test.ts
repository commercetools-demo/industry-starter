import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
const ct = {
  login: vi.fn(),
  createCustomer: vi.fn(),
  emailToken: vi.fn(),
  emailConfirm: vi.fn(),
  byEmailToken: vi.fn(),
  byId: vi.fn(),
  password: vi.fn(),
};
const call = <A, R>(fn: (arg: A) => R) => (arg: A) => ({ execute: () => fn(arg) });
const getCall = <A, R>(fn: (arg: A) => R) => (arg: A) => ({ get: () => ({ execute: () => fn(arg) }) });

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    login: () => ({ post: call((a: unknown) => ct.login(a)) }),
    customObjects: () => fake.customObjects(),
    customers: () => ({
      post: call((a: unknown) => ct.createCustomer(a)),
      emailToken: () => ({ post: call((a: unknown) => ct.emailToken(a)) }),
      emailConfirm: () => ({ post: call((a: unknown) => ct.emailConfirm(a)) }),
      password: () => ({ post: call((a: unknown) => ct.password(a)) }),
      withEmailToken: getCall((a: unknown) => ct.byEmailToken(a)),
      withId: getCall((a: unknown) => ct.byId(a)),
    }),
  },
}));
const clearCustomer = vi.fn();
vi.mock('@/lib/session', () => ({ clearCustomer: () => clearCustomer() }));

import {
  EmailUnavailableError,
  InvalidCredentialsError,
  TooManyAttemptsError,
  ValidationError,
  WrongCurrentPasswordError,
  changePassword,
  confirmEmail,
  getCustomerById,
  login,
  logout,
  register,
  requestFreshVerification,
} from './identity';

const ctError = (statusCode: number, code: string) => Object.assign(new Error(`${code} secret-detail`), { statusCode, body: { errors: [{ code }] } });
const customer = (over: Record<string, unknown> = {}) => ({
  id: 'c1', version: 3, email: 'sam@example.com', firstName: 'Sam', lastName: 'Rivera', isEmailVerified: true, ...over,
});

beforeEach(() => {
  fake = createFakeObjects();
  for (const fn of Object.values(ct)) fn.mockReset();
  clearCustomer.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('authentication-and-identity: Sign in carries the anonymous cart', () => {
  it('passes the session cart as anonymousCart with merge mode and returns the resulting cart', async () => {
    ct.login.mockResolvedValue({ body: { customer: customer(), cart: { id: 'cart-merged' } } });
    const outcome = await login({ email: ' Sam@Example.com ', password: 'pw', anonymousCartId: 'cart-anon' });
    expect(ct.login).toHaveBeenCalledWith({
      body: {
        email: 'sam@example.com',
        password: 'pw',
        anonymousCart: { id: 'cart-anon', typeId: 'cart' },
        anonymousCartSignInMode: 'MergeWithExistingCustomerCart',
        updateProductData: false,
      },
    });
    expect(outcome.cartId).toBe('cart-merged');
    expect(outcome.user.id).toBe('c1');
  });

  it('without a session cart no anonymousCart is sent; the customer cart (if any) comes back', async () => {
    ct.login.mockResolvedValue({ body: { customer: customer(), cart: { id: 'cart-existing' } } });
    const outcome = await login({ email: 'sam@example.com', password: 'pw' });
    const body = (ct.login.mock.calls[0][0] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty('anonymousCart');
    expect(outcome.cartId).toBe('cart-existing');
  });

  it('no cart anywhere: cartId is undefined', async () => {
    ct.login.mockResolvedValue({ body: { customer: customer() } });
    expect((await login({ email: 'sam@example.com', password: 'pw' })).cartId).toBeUndefined();
  });

  it('a stale session cart does not block sign-in: it is retried once without the cart', async () => {
    ct.login.mockRejectedValueOnce(ctError(400, 'InvalidOperation')).mockResolvedValueOnce({ body: { customer: customer() } });
    const outcome = await login({ email: 'sam@example.com', password: 'pw', anonymousCartId: 'gone' });
    expect(ct.login).toHaveBeenCalledTimes(2);
    expect(outcome.user.id).toBe('c1');
  });
});

describe('account-sign-in: Unknown and wrong are indistinguishable', () => {
  it('unknown email and wrong password raise the same error type and message', async () => {
    ct.login.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    const a = await login({ email: 'nobody@example.com', password: 'x' }).catch((e: unknown) => e);
    const b = await login({ email: 'sam@example.com', password: 'wrong' }).catch((e: unknown) => e);
    expect(a).toBeInstanceOf(InvalidCredentialsError);
    expect(b).toBeInstanceOf(InvalidCredentialsError);
    expect((a as Error).message).toBe((b as Error).message);
  });

  it('an invalid-credentials answer with a stale cart is NOT retried (no second guess against the password)', async () => {
    ct.login.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    await expect(login({ email: 'sam@example.com', password: 'x', anonymousCartId: 'c' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(ct.login).toHaveBeenCalledTimes(1);
  });

  it('other failures are not turned into "wrong password"', async () => {
    ct.login.mockRejectedValue(ctError(503, 'General'));
    await expect(login({ email: 'sam@example.com', password: 'x' })).rejects.not.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('account-sign-in: attempt limit (5 per 10 minutes per email and client)', () => {
  it('the sixth attempt is refused without calling commercetools, for a known and an unknown email alike', async () => {
    ct.login.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    for (const email of ['sam@example.com', 'nobody@example.com']) {
      for (let i = 0; i < 5; i += 1) await login({ email, password: 'x', clientKey: '1.2.3.4' }).catch(() => undefined);
    }
    ct.login.mockClear();
    const known = await login({ email: 'sam@example.com', password: 'right', clientKey: '1.2.3.4' }).catch((e: unknown) => e);
    const unknown = await login({ email: 'nobody@example.com', password: 'x', clientKey: '1.2.3.4' }).catch((e: unknown) => e);
    expect(known).toBeInstanceOf(TooManyAttemptsError);
    expect(unknown).toBeInstanceOf(TooManyAttemptsError);
    expect((known as TooManyAttemptsError).message).toBe((unknown as TooManyAttemptsError).message);
    expect(ct.login).not.toHaveBeenCalled();
  });

  it('another client or another email has its own bucket', async () => {
    ct.login.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    for (let i = 0; i < 5; i += 1) await login({ email: 'sam@example.com', password: 'x', clientKey: '1.2.3.4' }).catch(() => undefined);
    await expect(login({ email: 'sam@example.com', password: 'x', clientKey: '9.9.9.9' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(login({ email: 'alex@example.com', password: 'x', clientKey: '1.2.3.4' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('the stored bucket key contains neither the email nor the client address', async () => {
    ct.login.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    await login({ email: 'sam@example.com', password: 'x', clientKey: '1.2.3.4' }).catch(() => undefined);
    const keys = fake.objects.map((o) => o.key).join(' ');
    expect(keys).toMatch(/^rl-login-[0-9a-f]{32}$/);
    expect(keys).not.toContain('sam');
    expect(keys).not.toContain('1.2.3.4');
  });

  it('a successful sign-in is not blocked by a throttle store outage (fails open, logged)', async () => {
    fake.failOn = () => new Error('store down');
    ct.login.mockResolvedValue({ body: { customer: customer() } });
    expect((await login({ email: 'sam@example.com', password: 'pw' })).user.id).toBe('c1');
  });
});

describe('account-registration-request: Request recorded not active', () => {
  it('creates an active, auto-verified customer with an opaque patientRef and no funding scheme', async () => {
    ct.createCustomer.mockResolvedValue({ body: { customer: customer({ id: 'c9', isEmailVerified: false }), cart: { id: 'cart-1' } } });
    ct.emailToken.mockResolvedValue({ body: { value: 'tok-123' } });
    ct.emailConfirm.mockResolvedValue({ body: customer({ id: 'c9', isEmailVerified: true }) });
    const outcome = await register({ name: 'Sam Rivera', email: 'New@Example.com', password: 'a-long-passphrase', anonymousCartId: 'cart-anon' });
    const body = (ct.createCustomer.mock.calls[0][0] as { body: { custom: { type: unknown; fields: Record<string, unknown> } } & Record<string, unknown> }).body;
    expect(body).toMatchObject({ email: 'new@example.com', firstName: 'Sam', lastName: 'Rivera', anonymousCart: { id: 'cart-anon', typeId: 'cart' } });
    expect(body.custom.type).toEqual({ typeId: 'type', key: 'mlv-patient' });
    expect(body.custom.fields.patientRef).toMatch(/^pt_[a-z0-9]{8}$/);
    expect(body.custom.fields).not.toHaveProperty('fundingScheme');
    expect(body).not.toHaveProperty('isEmailVerified');
    expect(ct.emailToken).toHaveBeenCalledWith({ body: { id: 'c9', ttlMinutes: 10 } });
    expect(ct.emailConfirm).toHaveBeenCalledWith({ body: { tokenValue: 'tok-123' } });
    expect(outcome).toMatchObject({ emailVerified: true, cartId: 'cart-1' });
    expect(outcome.user.isEmailVerified).toBe(true);
  });

  it('patientRef values differ between registrations', async () => {
    ct.createCustomer.mockResolvedValue({ body: { customer: customer() } });
    ct.emailToken.mockResolvedValue({ body: { value: 't' } });
    ct.emailConfirm.mockResolvedValue({ body: customer() });
    await register({ name: 'A B', email: 'a@example.com', password: 'long-enough-1' });
    await register({ name: 'A B', email: 'b@example.com', password: 'long-enough-1' });
    const refs = ct.createCustomer.mock.calls.map((c) => (c[0] as { body: { custom: { fields: { patientRef: string } } } }).body.custom.fields.patientRef);
    expect(new Set(refs).size).toBe(2);
  });

  it('a failed auto-verification leaves a working account reported as not verified', async () => {
    ct.createCustomer.mockResolvedValue({ body: { customer: customer({ isEmailVerified: false }) } });
    ct.emailToken.mockRejectedValue(ctError(500, 'General'));
    const outcome = await register({ name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' });
    expect(outcome.emailVerified).toBe(false);
    expect(outcome.user.id).toBe('c1');
  });

  it('validation runs on the server with the shared rules and never reaches commercetools', async () => {
    const error = await register({ name: '', email: 'nope', password: 'short' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).problems).toEqual({ name: 'required', email: 'invalid', password: 'tooShort' });
    expect(ct.createCustomer).not.toHaveBeenCalled();
  });
});

describe('account-registration-request: Address already registered', () => {
  it('a duplicate address raises EmailUnavailableError whose text does not mention the address', async () => {
    ct.createCustomer.mockRejectedValue(ctError(400, 'DuplicateField'));
    const error = await register({ name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailUnavailableError);
    expect((error as Error).message).not.toContain('sam@example.com');
    expect(ct.emailToken).not.toHaveBeenCalled();
  });

  it('five duplicate attempts from one client lock registration, so addresses cannot be enumerated', async () => {
    ct.createCustomer.mockRejectedValue(ctError(400, 'DuplicateField'));
    for (let i = 0; i < 5; i += 1) {
      await register({ name: 'A B', email: `p${i}@example.com`, password: 'a-long-passphrase', clientKey: '7.7.7.7' }).catch(() => undefined);
    }
    ct.createCustomer.mockClear();
    await expect(register({ name: 'A B', email: 'fresh@example.com', password: 'a-long-passphrase', clientKey: '7.7.7.7' })).rejects.toBeInstanceOf(TooManyAttemptsError);
    expect(ct.createCustomer).not.toHaveBeenCalled();
  });
});

describe('email-verification', () => {
  it('Token valid address confirmed', async () => {
    ct.byEmailToken.mockResolvedValue({ body: customer({ isEmailVerified: false }) });
    ct.emailConfirm.mockResolvedValue({ body: customer() });
    expect(await confirmEmail('tok')).toEqual({ status: 'verified', customerId: 'c1' });
    expect(ct.emailConfirm).toHaveBeenCalledWith({ body: { tokenValue: 'tok' } });
  });

  it('Token expired: stated as expired, the dead token is not retried', async () => {
    ct.byEmailToken.mockRejectedValue(ctError(400, 'InvalidInput'));
    expect(await confirmEmail('old')).toEqual({ status: 'expired' });
    expect(ct.emailConfirm).not.toHaveBeenCalled();
  });

  it('Token expired between lookup and confirm is also reported as expired', async () => {
    ct.byEmailToken.mockResolvedValue({ body: customer({ isEmailVerified: false }) });
    ct.emailConfirm.mockRejectedValue(ctError(400, 'InvalidInput'));
    expect(await confirmEmail('old')).toEqual({ status: 'expired' });
  });

  it('Resend needs an identified account: no session means sign in first and no token is issued', async () => {
    expect(await requestFreshVerification(undefined)).toEqual({ status: 'sign-in-required' });
    expect(ct.emailToken).not.toHaveBeenCalled();
  });

  it('Resend for a signed-in unverified account issues a short-lived token', async () => {
    ct.byId.mockResolvedValue({ body: customer({ isEmailVerified: false }) });
    ct.emailToken.mockResolvedValue({ body: { value: 'fresh' } });
    expect(await requestFreshVerification('c1')).toEqual({ status: 'issued', tokenValue: 'fresh', ttlMinutes: 10 });
    expect(ct.emailToken).toHaveBeenCalledWith({ body: { id: 'c1', ttlMinutes: 10 } });
  });

  it('Link opened twice: an already verified account is told so, not shown a token error', async () => {
    ct.byEmailToken.mockResolvedValue({ body: customer({ isEmailVerified: true }) });
    expect(await confirmEmail('tok')).toEqual({ status: 'already-verified', customerId: 'c1' });
    expect(ct.emailConfirm).not.toHaveBeenCalled();
  });

  it('Link opened twice: a consumed token with a verified signed-in visitor also answers already verified', async () => {
    ct.byEmailToken.mockRejectedValue(ctError(400, 'InvalidInput'));
    ct.byId.mockResolvedValue({ body: customer({ isEmailVerified: true }) });
    expect(await confirmEmail('used', 'c1')).toEqual({ status: 'already-verified', customerId: 'c1' });
  });

  it('Resend for an already verified account issues nothing', async () => {
    ct.byId.mockResolvedValue({ body: customer({ isEmailVerified: true }) });
    expect(await requestFreshVerification('c1')).toEqual({ status: 'already-verified' });
    expect(ct.emailToken).not.toHaveBeenCalled();
  });
});

describe('authentication-and-identity: account functions', () => {
  it('getCustomerById maps a customer and returns null for 404', async () => {
    ct.byId.mockResolvedValueOnce({ body: customer() }).mockRejectedValueOnce(ctError(404, 'ResourceNotFound'));
    expect(await getCustomerById('c1')).toEqual({ id: 'c1', email: 'sam@example.com', firstName: 'Sam', lastName: 'Rivera', isEmailVerified: true });
    expect(await getCustomerById('c1')).toBeNull();
  });

  it('changePassword posts id, version, current and new password', async () => {
    ct.byId.mockResolvedValue({ body: customer({ version: 7 }) });
    ct.password.mockResolvedValue({ body: customer() });
    await changePassword('c1', 'old-password-1', 'new-password-12');
    expect(ct.password).toHaveBeenCalledWith({ body: { id: 'c1', version: 7, currentPassword: 'old-password-1', newPassword: 'new-password-12' } });
  });

  it('changePassword: a wrong current password is WrongCurrentPasswordError and a short new one never reaches commercetools', async () => {
    ct.byId.mockResolvedValue({ body: customer() });
    ct.password.mockRejectedValue(ctError(400, 'InvalidCurrentPassword'));
    await expect(changePassword('c1', 'nope', 'new-password-12')).rejects.toBeInstanceOf(WrongCurrentPasswordError);
    ct.byId.mockClear();
    await expect(changePassword('c1', 'old', 'short')).rejects.toBeInstanceOf(ValidationError);
    expect(ct.byId).not.toHaveBeenCalled();
  });

  it('logout clears the cookie session only', async () => {
    await logout();
    expect(clearCustomer).toHaveBeenCalledTimes(1);
    expect(Object.values(ct).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
