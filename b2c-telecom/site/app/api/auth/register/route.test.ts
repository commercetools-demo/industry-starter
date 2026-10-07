// @vitest-environment node
import type { Cart } from '@/lib/types';
import { apiRoot, authRequest, ctCustomer, failure, resetWorld, sameIp, world } from '@/test/fixtures/authWorld';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => apiRoot }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/authWorld')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
const readBundle = vi.fn();
vi.mock('@/lib/ct/bundle', () => ({ readBundle: (...args: unknown[]) => readBundle(...args) }));

import { POST } from './route';

const register = (body: unknown, headers: Record<string, string> = {}) => POST(authRequest('/api/auth/register', body, headers));
const valid = { firstName: 'Chrome', lastName: 'Tester', email: 'Chrome-R-1@Example.com', password: 'Aa1-valid-pass-2026' };

beforeEach(() => {
  resetWorld({ anonymousId: 'anon-1', cartId: 'cart-1' });
  readBundle.mockReset();
  readBundle.mockResolvedValue({ cart: { id: 'cart-9', issues: [], lines: [] } as unknown as Cart, cartId: 'cart-9' });
  world.handler = (call) => {
    if (call.path === 'customers') return { customer: ctCustomer({ isEmailVerified: false, email: 'chrome-r-1@example.com' }) };
    if (call.path === 'customers/email-token') return { value: 'email-token-123' };
    if (call.path === 'customers/email/confirm') return ctCustomer({ isEmailVerified: true });
    return { customer: ctCustomer({ email: 'chrome-r-1@example.com' }), cart: { id: 'cart-9' } };
  };
});

describe('POST /api/auth/register', () => {
  it('creates a verified consumer account, signs in with the merge and answers 201 without any token', async () => {
    const res = await register(valid);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe('chrome-r-1@example.com');
    expect(body.redirectTo).toBe('/en-US/account');
    expect(world.calls.map((call) => call.path)).toEqual(['customers', 'customers/email-token', 'customers/email/confirm', 'login']);
    expect(world.calls[0]?.body).toMatchObject({ email: 'chrome-r-1@example.com', firstName: 'Chrome', lastName: 'Tester', customerGroup: { typeId: 'customer-group', key: 'consumer' }, locale: 'en-US' });
    expect((world.calls[0]?.body as { customerNumber: string }).customerNumber).toMatch(/^MV-\d{5}-\d$/);
    expect(world.calls[3]?.body).toMatchObject({ anonymousCart: { typeId: 'cart', id: 'cart-1' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' });
    expect(world.patches[0]).toMatchObject({ customerId: 'c-1', cartId: 'cart-9' });
    const text = JSON.stringify(body);
    expect(text).not.toContain('email-token-123');
    expect(text).not.toMatch(/password/i);
  });

  it('a duplicate email answers 409 ACCOUNT_EXISTS with the message to log in or reset', async () => {
    world.handler = () => {
      throw failure(400, 'DuplicateField', 'email');
    };
    const res = await register(valid);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Log in or reset your password.' } });
    expect(world.patches).toEqual([]);
  });

  it('a weak password answers 400 WEAK_PASSWORD naming the rules, before any commercetools call', async () => {
    const res = await register({ ...valid, password: 'short1A' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('WEAK_PASSWORD');
    expect(body.error.details.failed).toContain('min-length');
    expect(world.calls).toEqual([]);
  });

  it('refuses a password that contains the email name', async () => {
    const res = await register({ ...valid, email: 'janedoe@example.com', password: 'Xx1-janedoe-2026' });
    expect((await res.json()).error.details.failed).toEqual(['not-email']);
  });

  it('refuses missing names and a bad email with 400 INVALID_INPUT naming the fields', async () => {
    const res = await register({ ...valid, firstName: '  ', lastName: 'x'.repeat(61), email: 'nope' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.fields).toEqual(['firstName', 'lastName', 'email']);
    expect(world.calls).toEqual([]);
  });

  it('still registers when the email confirmation fails (the account exists)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.handler = (call) => {
      if (call.path === 'customers') return { customer: ctCustomer({ isEmailVerified: false }) };
      if (call.path === 'customers/email-token') throw failure(500, 'General');
      return { customer: ctCustomer() };
    };
    expect((await register(valid)).status).toBe(201);
    log.mockRestore();
  });

  it('limits one IP to 5 registrations per hour', async () => {
    for (let i = 0; i < 5; i += 1) expect((await register(valid, sameIp('203.0.113.55'))).status).toBe(201);
    const blocked = await register(valid, sameIp('203.0.113.55'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).not.toBeNull();
  });

  it('refuses another origin', async () => {
    expect((await register(valid, { origin: 'https://evil.example' })).status).toBe(403);
    expect(world.calls).toEqual([]);
  });
});
