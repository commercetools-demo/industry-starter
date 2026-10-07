// @vitest-environment node
import type { Customer } from '@commercetools/platform-sdk';

type Call = { method: 'GET' | 'POST'; path: string; body?: unknown };
const world = {
  calls: [] as Call[],
  handler: ((): unknown => ({})) as (call: Call) => unknown,
};

const failure = (statusCode: number, code: string, field?: string) => Object.assign(new Error(code), { statusCode, body: { errors: [{ code, ...(field ? { field } : {}) }] } });

function builder(path: string) {
  return {
    get: () => ({ execute: async () => ({ body: world.handler((world.calls[world.calls.push({ method: 'GET', path }) - 1] as Call)) }) }),
    post: ({ body }: { body: unknown }) => ({ execute: async () => ({ body: world.handler((world.calls[world.calls.push({ method: 'POST', path, body }) - 1] as Call)) }) }),
  };
}
const root = {
  login: () => builder('login'),
  customers: () => ({
    ...builder('customers'),
    emailToken: () => builder('customers/email-token'),
    emailConfirm: () => builder('customers/email/confirm'),
    passwordToken: () => builder('customers/password-token'),
    passwordReset: () => builder('customers/password/reset'),
    withPasswordToken: ({ passwordToken }: { passwordToken: string }) => builder(`customers/password-token=${passwordToken}`),
    withId: ({ ID }: { ID: string }) => builder(`customers/${ID}`),
  }),
};
vi.mock('./client', () => ({ getApiRoot: () => root }));
vi.mock('./env-core', () => ({ isDemoMode: () => false }));

import {
  AccountExistsError,
  createPasswordResetToken,
  generateCustomerNumber,
  getCustomerById,
  InvalidCredentialsError,
  InvalidTokenError,
  markSessionsInvalid,
  resetPassword,
  sessionsValidAfterOf,
  signIn,
  signUp,
  validatePasswordToken,
  verifyEmailNow,
} from './customer';

const customer = (patch: Partial<Customer> = {}): Customer => ({ id: 'c-1', version: 4, email: 'jane@example.com', isEmailVerified: false, ...patch }) as Customer;

beforeEach(() => {
  world.calls = [];
  world.handler = () => ({});
});

describe('signIn', () => {
  it('posts /login with the anonymous cart id only (no version) and the merge mode', async () => {
    world.handler = () => ({ customer: customer(), cart: { id: 'cart-9' } });
    const result = await signIn('jane@example.com', 'pw', { anonymousId: 'a', cartId: 'cart-1' });
    expect(world.calls).toEqual([
      {
        method: 'POST',
        path: 'login',
        body: { email: 'jane@example.com', password: 'pw', anonymousCart: { typeId: 'cart', id: 'cart-1' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart', updateProductData: true },
      },
    ]);
    expect(result.cart).toMatchObject({ id: 'cart-9' });
  });

  it('sends no anonymous cart without a session cart', async () => {
    world.handler = () => ({ customer: customer() });
    const result = await signIn('jane@example.com', 'pw', {});
    expect(world.calls[0]?.body).toEqual({ email: 'jane@example.com', password: 'pw', updateProductData: true });
    expect(result.cart).toBeNull();
  });

  it('maps InvalidCredentials to InvalidCredentialsError without a retry', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidCredentials');
    };
    await expect(signIn('jane@example.com', 'bad', { cartId: 'cart-1' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(world.calls).toHaveLength(1);
  });

  it('retries once without the anonymous cart when only the cart is stale', async () => {
    let first = true;
    world.handler = () => {
      if (first) {
        first = false;
        throw failure(400, 'InvalidOperation');
      }
      return { customer: customer() };
    };
    const result = await signIn('jane@example.com', 'pw', { cartId: 'stale' });
    expect(result.customer.id).toBe('c-1');
    expect(world.calls).toHaveLength(2);
    expect((world.calls[1]?.body as Record<string, unknown>).anonymousCart).toBeUndefined();
  });

  it('does not retry a server error', async () => {
    world.handler = () => {
      throw failure(500, 'General');
    };
    await expect(signIn('jane@example.com', 'pw', { cartId: 'cart-1' })).rejects.toThrow();
    expect(world.calls).toHaveLength(1);
  });
});

describe('signUp', () => {
  it('creates the customer in group consumer with a generated number and the locale', async () => {
    world.handler = () => ({ customer: customer() });
    await signUp({ email: 'jane@example.com', password: 'pw', firstName: 'Jane', lastName: 'Doe', locale: 'de-DE' }, () => 'MV-12345-5');
    expect(world.calls[0]).toEqual({
      method: 'POST',
      path: 'customers',
      body: {
        email: 'jane@example.com',
        password: 'pw',
        firstName: 'Jane',
        lastName: 'Doe',
        customerNumber: 'MV-12345-5',
        customerGroup: { typeId: 'customer-group', key: 'consumer' },
        locale: 'de-DE',
      },
    });
  });

  it('a duplicate email is AccountExistsError', async () => {
    world.handler = () => {
      throw failure(400, 'DuplicateField', 'email');
    };
    await expect(signUp({ email: 'a@b.co', password: 'pw', firstName: 'A', lastName: 'B', locale: 'en-US' })).rejects.toBeInstanceOf(AccountExistsError);
  });

  it('a duplicate customer number is retried with a new number, at most 3 times', async () => {
    const numbers = ['MV-00000-0', 'MV-11111-5', 'MV-22222-0'];
    let n = 0;
    world.handler = () => {
      if (world.calls.length < 3) throw failure(400, 'DuplicateField', 'customerNumber');
      return { customer: customer() };
    };
    await signUp({ email: 'a@b.co', password: 'pw', firstName: 'A', lastName: 'B', locale: 'en-US' }, () => numbers[n++] as string);
    expect(world.calls.map((call) => (call.body as { customerNumber: string }).customerNumber)).toEqual(numbers);

    world.calls = [];
    world.handler = () => {
      throw failure(400, 'DuplicateField', 'customerNumber');
    };
    await expect(signUp({ email: 'a@b.co', password: 'pw', firstName: 'A', lastName: 'B', locale: 'en-US' }, () => 'MV-1')).rejects.toThrow();
    expect(world.calls).toHaveLength(3);
  });
});

describe('generateCustomerNumber', () => {
  it('is MV-<5 digits>-<digit sum mod 10>', () => {
    const digits = [1, 2, 3, 4, 9];
    let i = 0;
    expect(generateCustomerNumber(() => digits[i++] as number)).toBe('MV-12349-9');
    expect(generateCustomerNumber()).toMatch(/^MV-\d{5}-\d$/);
  });
});

describe('verifyEmailNow', () => {
  it('Token valid address confirmed: registration creates the email token and confirms it at once', async () => {
    world.handler = (call) => (call.path === 'customers/email-token' ? { value: 'tok-123456789' } : { id: 'c-1', version: 6, isEmailVerified: true });
    const result = await verifyEmailNow({ id: 'c-1', version: 4, isEmailVerified: false });
    expect(world.calls).toEqual([
      { method: 'POST', path: 'customers/email-token', body: { id: 'c-1', version: 4, ttlMinutes: 5 } },
      { method: 'POST', path: 'customers/email/confirm', body: { tokenValue: 'tok-123456789' } },
    ]);
    expect(result.isEmailVerified).toBe(true);
  });

  it('Link opened twice: verifying an already verified customer does nothing and does not error', async () => {
    const result = await verifyEmailNow({ id: 'c-1', version: 6, isEmailVerified: true });
    expect(world.calls).toEqual([]);
    expect(result.isEmailVerified).toBe(true);
  });
});

describe('password reset calls', () => {
  it('requests a 60 minute token that invalidates older ones', async () => {
    world.handler = () => ({ value: 'reset-token-123', customerId: 'c-1' });
    expect(await createPasswordResetToken('jane@example.com')).toEqual({ value: 'reset-token-123', customerId: 'c-1' });
    expect(world.calls[0]).toEqual({ method: 'POST', path: 'customers/password-token', body: { email: 'jane@example.com', ttlMinutes: 60, invalidateOlderTokens: true } });
  });

  it('returns null for an unknown email (404 swallowed) and rethrows other failures', async () => {
    world.handler = () => {
      throw failure(404, 'ResourceNotFound');
    };
    expect(await createPasswordResetToken('nobody@example.com')).toBeNull();
    world.handler = () => {
      throw failure(500, 'General');
    };
    await expect(createPasswordResetToken('x@example.com')).rejects.toThrow();
  });

  it('validates a token with a GET that does not consume it; unknown or malformed tokens give null', async () => {
    world.handler = () => customer();
    expect((await validatePasswordToken('good-token-1234'))?.id).toBe('c-1');
    expect(world.calls).toEqual([{ method: 'GET', path: 'customers/password-token=good-token-1234' }]);
    world.handler = () => {
      throw failure(404, 'ResourceNotFound');
    };
    expect(await validatePasswordToken('gone-token-1234')).toBeNull();
    world.calls = [];
    expect(await validatePasswordToken('../../x')).toBeNull();
    expect(await validatePasswordToken('')).toBeNull();
    expect(world.calls).toEqual([]);
  });

  it('resets with the token value and maps an invalid token to InvalidTokenError', async () => {
    world.handler = () => customer({ isEmailVerified: true });
    await resetPassword('reset-token-123', 'New-Passw0rd-2026');
    expect(world.calls[0]).toEqual({ method: 'POST', path: 'customers/password/reset', body: { tokenValue: 'reset-token-123', newPassword: 'New-Passw0rd-2026' } });
    world.handler = () => {
      throw failure(400, 'InvalidToken');
    };
    await expect(resetPassword('reset-token-123', 'x')).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe('getCustomerById and markSessionsInvalid', () => {
  it('returns null for an unknown id', async () => {
    world.handler = () => {
      throw failure(404, 'ResourceNotFound');
    };
    expect(await getCustomerById('nope')).toBeNull();
  });

  it('sets the custom field when the customer has a custom type, else sets the type with the field', async () => {
    const now = new Date('2026-10-07T12:00:00.000Z');
    world.handler = (call) => (call.method === 'GET' ? customer({ custom: { type: { typeId: 'type', id: 't' }, fields: {} } }) : {});
    await markSessionsInvalid('c-1', now);
    expect(world.calls[1]).toEqual({
      method: 'POST',
      path: 'customers/c-1',
      body: { version: 4, actions: [{ action: 'setCustomField', name: 'sessionsValidAfter', value: '2026-10-07T12:00:00.000Z' }] },
    });
    world.calls = [];
    world.handler = (call) => (call.method === 'GET' ? customer() : {});
    await markSessionsInvalid('c-1', now);
    expect(world.calls[1]?.body).toEqual({
      version: 4,
      actions: [{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-customer' }, fields: { sessionsValidAfter: '2026-10-07T12:00:00.000Z' } }],
    });
  });

  it('reads sessionsValidAfter as epoch milliseconds', () => {
    expect(sessionsValidAfterOf(customer())).toBeUndefined();
    expect(sessionsValidAfterOf(customer({ custom: { type: { typeId: 'type', id: 't' }, fields: { sessionsValidAfter: '2026-10-07T12:00:00.000Z' } } }))).toBe(Date.parse('2026-10-07T12:00:00.000Z'));
  });
});

describe('no secrets in logs', () => {
  it('never writes a password or token to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => undefined));
    world.handler = () => ({ value: 'reset-token-SECRET', customerId: 'c-1' });
    await createPasswordResetToken('jane@example.com');
    world.handler = () => ({ customer: customer() });
    await signIn('jane@example.com', 'pw-SECRET', {});
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/SECRET/);
      spy.mockRestore();
    }
  });
});
