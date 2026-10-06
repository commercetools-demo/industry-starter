// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), updateSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/auth', () => ({ AccountExistsError: class AccountExistsError extends Error {}, signUp: vi.fn(), signIn: vi.fn() }));

import { AccountExistsError, signIn, signUp } from '@/lib/ct/auth';
import { getSession, updateSession } from '@/lib/session';
import { POST } from './route';

const customer = { id: 'cust-1', email: 'new@b.co', firstName: 'Ada', lastName: 'Lovelace', version: 2 };
const valid = { firstName: 'Ada', lastName: 'Lovelace', email: 'new@b.co', password: 'longenough' };
let n = 0;
const req = (body: unknown) =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `20.0.0.${++n}` },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ cartId: 'anon-cart' });
});

describe('POST /api/auth/register', () => {
  it('Weak password: 400 WEAK_PASSWORD and no customer is created', async () => {
    const res = await POST(req({ ...valid, password: 'short' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'WEAK_PASSWORD' });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('Invalid input (missing name, bad email): 400 INVALID_INPUT', async () => {
    expect((await POST(req({ ...valid, firstName: ' ' }))).status).toBe(400);
    const res = await POST(req({ ...valid, email: 'not-an-email' }));
    expect(await res.json()).toEqual({ error: 'INVALID_INPUT' });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('Duplicate email: 409 ACCOUNT_EXISTS and nobody is signed in', async () => {
    vi.mocked(signUp).mockRejectedValue(new AccountExistsError());
    const res = await POST(req(valid));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'ACCOUNT_EXISTS' });
    expect(signIn).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('Register: the customer is created (verified inside signUp), signed in with the anonymous cart merged', async () => {
    vi.mocked(signUp).mockResolvedValue(customer as never);
    vi.mocked(signIn).mockResolvedValue({ customer, cart: { id: 'merged', cartState: 'Active' } } as never);
    const res = await POST(req({ ...valid, email: ' new@b.co ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'cust-1', email: 'new@b.co', firstName: 'Ada', lastName: 'Lovelace' } });
    expect(signUp).toHaveBeenCalledWith(valid);
    expect(signIn).toHaveBeenCalledWith('new@b.co', 'longenough', 'anon-cart');
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1', cartId: 'merged' }), expect.anything());
  });

  it('Unexpected failure: 500 REGISTER_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(signUp).mockRejectedValue(new Error('boom'));
    expect((await POST(req(valid))).status).toBe(500);
  });

  it('Rate limit: the 6th request in a minute is 429', async () => {
    vi.mocked(signUp).mockRejectedValue(new AccountExistsError());
    const same = () =>
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '30.0.0.1' },
        body: JSON.stringify(valid),
      });
    for (let i = 0; i < 5; i++) expect((await POST(same())).status).toBe(409);
    const res = await POST(same());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
  });

  it('No email is sent: the route and auth helpers import no mail module', () => {
    const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/import .*(mail|smtp|sendgrid|nodemailer|resend)/i);
  });
});
