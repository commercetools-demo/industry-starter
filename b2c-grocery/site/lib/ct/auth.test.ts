import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const loginPost = vi.fn();
const customersPost = vi.fn();
const emailTokenPost = vi.fn();
const emailConfirmPost = vi.fn();
const passwordTokenPost = vi.fn();
const passwordResetPost = vi.fn();
const wrap = (name: string, fn: (arg: unknown) => unknown) => (arg: unknown) => {
  calls.push(name);
  return { execute: () => fn(arg) };
};
vi.mock('./client', () => ({
  getApiRoot: () => ({
    login: () => ({ post: wrap('login', loginPost) }),
    customers: () => ({
      post: wrap('signup', customersPost),
      emailToken: () => ({ post: wrap('emailToken', emailTokenPost) }),
      emailConfirm: () => ({ post: wrap('emailConfirm', emailConfirmPost) }),
      passwordToken: () => ({ post: wrap('passwordToken', passwordTokenPost) }),
      passwordReset: () => ({ post: wrap('passwordReset', passwordResetPost) }),
    }),
  }),
}));

import { AccountExistsError, InvalidCredentialsError, InvalidTokenError, createPasswordResetToken, resetPassword, signIn, signUp } from './auth';

const ctError = (statusCode: number, code: string) => Object.assign(new Error(code), { statusCode, body: { errors: [{ code }] } });
const customer = { id: 'c-1', version: 3, email: 'a@b.co' };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe('signIn', () => {
  it('uses login().post with merge mode and the anonymous cart', async () => {
    loginPost.mockResolvedValue({ body: { customer, cart: { id: 'cart-9' } } });
    const r = await signIn('a@b.co', 'secret-pass', 'cart-1');
    expect(loginPost).toHaveBeenCalledWith({
      body: { email: 'a@b.co', password: 'secret-pass', anonymousCart: { id: 'cart-1', typeId: 'cart' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' },
    });
    expect(r.cart).toEqual({ id: 'cart-9' });
  });

  it('no anonymous cart: sends no cart fields', async () => {
    loginPost.mockResolvedValue({ body: { customer } });
    await signIn('a@b.co', 'secret-pass');
    expect(loginPost.mock.calls[0][0]).toEqual({ body: { email: 'a@b.co', password: 'secret-pass' } });
  });

  it('wrong password and unknown email throw the same error', async () => {
    loginPost.mockRejectedValue(ctError(400, 'InvalidCredentials'));
    await expect(signIn('a@b.co', 'bad', 'cart-1')).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(loginPost).toHaveBeenCalledTimes(1);
  });

  it('a stale anonymous cart does not block sign-in: retries without it', async () => {
    loginPost.mockRejectedValueOnce(ctError(400, 'InvalidInput')).mockResolvedValueOnce({ body: { customer } });
    const r = await signIn('a@b.co', 'secret-pass', 'gone');
    expect(r.customer).toEqual(customer);
    expect(loginPost.mock.calls[1][0]).toEqual({ body: { email: 'a@b.co', password: 'secret-pass' } });
  });
});

describe('signUp', () => {
  it('creates the customer, then the email token, then confirms it, in order', async () => {
    customersPost.mockResolvedValue({ body: { customer } });
    emailTokenPost.mockResolvedValue({ body: { value: 'tok' } });
    emailConfirmPost.mockResolvedValue({ body: {} });
    const draft = { email: 'a@b.co', password: 'secret-pass', firstName: 'A', lastName: 'B' };
    await signUp(draft);
    expect(calls).toEqual(['signup', 'emailToken', 'emailConfirm']);
    expect(customersPost).toHaveBeenCalledWith({ body: draft });
    expect(emailTokenPost).toHaveBeenCalledWith({ body: { id: 'c-1', version: 3, ttlMinutes: 5 } });
    expect(emailConfirmPost).toHaveBeenCalledWith({ body: { tokenValue: 'tok' } });
  });

  it('duplicate email: AccountExistsError and no token is created', async () => {
    customersPost.mockRejectedValue(ctError(400, 'DuplicateField'));
    await expect(signUp({ email: 'a@b.co', password: 'secret-pass', firstName: 'A', lastName: 'B' })).rejects.toBeInstanceOf(AccountExistsError);
    expect(emailTokenPost).not.toHaveBeenCalled();
  });
});

describe('createPasswordResetToken', () => {
  it('returns the token value (60 minutes)', async () => {
    passwordTokenPost.mockResolvedValue({ body: { value: 'reset-tok' } });
    expect(await createPasswordResetToken('a@b.co')).toBe('reset-tok');
    expect(passwordTokenPost).toHaveBeenCalledWith({ body: { email: 'a@b.co', ttlMinutes: 60 } });
  });
  it('unknown email: returns null instead of throwing', async () => {
    passwordTokenPost.mockRejectedValue(ctError(404, 'ResourceNotFound'));
    expect(await createPasswordResetToken('x@y.zz')).toBeNull();
  });
  it('other failures still throw', async () => {
    passwordTokenPost.mockRejectedValue(ctError(500, 'General'));
    await expect(createPasswordResetToken('a@b.co')).rejects.toThrow();
  });
});

describe('resetPassword', () => {
  it('returns the customer', async () => {
    passwordResetPost.mockResolvedValue({ body: customer });
    expect(await resetPassword('tok', 'new-password')).toEqual(customer);
    expect(passwordResetPost).toHaveBeenCalledWith({ body: { tokenValue: 'tok', newPassword: 'new-password' } });
  });
  it('invalid token: InvalidTokenError', async () => {
    passwordResetPost.mockRejectedValue(ctError(404, 'ResourceNotFound'));
    await expect(resetPassword('bad', 'new-password')).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
