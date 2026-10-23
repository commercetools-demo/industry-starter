// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ signIn: vi.fn(), createCustomer: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/auth', () => ct);

import { POST } from '@/app/api/auth/register/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type Session } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const valid = { email: 'qa-j@example.com', password: 'Strong-pass-1', firstName: 'Qa', lastName: 'Tester' };
const post = (body: unknown, ip = '8.8.8.1') =>
  POST(new Request('http://x/api/auth/register', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } }), ctx);
const seed = async (s: Session) => void jar.store.set(SESSION_COOKIE, await createSessionToken(s));
const written = (res: Response) =>
  verifySessionToken(new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(res.headers.get('set-cookie') ?? '')?.[1]);

beforeEach(() => {
  jar.store.clear();
  resetRateLimits();
  ct.signIn.mockReset().mockResolvedValue({ customer: { id: 'c9', email: valid.email, firstName: 'Qa', lastName: 'Tester', addresses: [] } });
  ct.createCustomer.mockReset().mockResolvedValue({ id: 'c9' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/auth/register', () => {
  it('Register refuses a weak password before any commercetools call', async () => {
    const res = await post({ ...valid, password: 'short' });
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error.code).toBe('password_policy');
    expect(error.failed).toEqual(['min_length', 'digit']);
    expect(ct.createCustomer).not.toHaveBeenCalled();
    expect(ct.signIn).not.toHaveBeenCalled();
  });

  it('Register creates a verified customer and signs in', async () => {
    await seed({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect((await res.json()).customer).toMatchObject({ id: 'c9' });
    expect(ct.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ email: valid.email, locale: 'en-CA' }));
    expect(await written(res)).toMatchObject({ customerId: 'c9', customerFirstName: 'Qa', country: 'CA' });
    expect(ct.createCustomer.mock.invocationCallOrder[0]).toBeLessThan(ct.signIn.mock.invocationCallOrder[0]);
  });

  it('Register deletes the guest-email prefill cookie', async () => {
    const res = await post(valid);
    expect(res.headers.get('set-cookie')).toMatch(/mcf_guest_email=;[^,]*Max-Age=0/i);
  });

  it('Register then merges the cart', async () => {
    ct.signIn.mockResolvedValue({ customer: { id: 'c9', email: valid.email, addresses: [] }, cart: { id: 'cart-7', lineItems: [{ quantity: 1 }] } });
    await seed({ cartId: 'cart-7', anonymousId: 'anon-7' });
    const res = await post(valid);
    expect(ct.signIn).toHaveBeenCalledWith(valid.email, valid.password, { cartId: 'cart-7', anonymousId: 'anon-7' });
    expect((await res.json()).cart).toEqual({ id: 'cart-7', lineCount: 1, quantity: 1 });
    expect((await written(res)).cartId).toBe('cart-7');
  });

  it('Register passes anonymousId so earlier orders attach', async () => {
    await seed({ anonymousId: 'anon-8' });
    const res = await post(valid);
    expect(ct.signIn.mock.calls[0][2]).toEqual({ cartId: undefined, anonymousId: 'anon-8' });
    expect((await written(res)).anonymousId).toBeUndefined();
  });

  it('Duplicate email gives a generic refusal', async () => {
    ct.createCustomer.mockRejectedValue({ statusCode: 400, errors: [{ code: 'DuplicateField' }], message: 'email in use' });
    const res = await post(valid);
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('registration_failed');
    expect(text).not.toMatch(/duplicate|in use|exists/i);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(ct.signIn).not.toHaveBeenCalled();
  });

  it('invalid input is a 400 and registrations are rate limited per ip', async () => {
    expect((await post({ ...valid, email: 'nope' })).status).toBe(400);
    expect((await post({ ...valid, firstName: '' })).status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await post(valid, '7.7.7.7')).status).toBe(201);
    const limited = await post(valid, '7.7.7.7');
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.retryAfterSeconds).toBeGreaterThan(0);
  });
});
