// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), updateSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/auth', () => ({ InvalidCredentialsError: class InvalidCredentialsError extends Error {}, signIn: vi.fn() }));

import { signIn, InvalidCredentialsError } from '@/lib/ct/auth';
import { getSession, updateSession } from '@/lib/session';
import { POST } from './route';

const customer = { id: 'cust-1', email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace', version: 1 };
const req = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ cartId: 'anon-cart' });
});

describe('POST /api/auth/login', () => {
  it('Sign in with items in the bag: passes the anonymous cart id and writes the merged cart id and identity to the session', async () => {
    vi.mocked(signIn).mockResolvedValue({ customer, cart: { id: 'merged-cart', cartState: 'Active' } } as never);
    const res = await POST(req({ email: ' a@b.co ', password: 'secret-pass' }, '10.0.0.1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'cust-1', email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace' } });
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'secret-pass', 'anon-cart');
    expect(updateSession).toHaveBeenCalledWith(
      { customerId: 'cust-1', customerEmail: 'a@b.co', customerFirstName: 'Ada', customerLastName: 'Lovelace', cartId: 'merged-cart' },
      expect.anything(),
    );
  });

  it('No cart came back: the session cart id is dropped', async () => {
    vi.mocked(signIn).mockResolvedValue({ customer } as never);
    await POST(req({ email: 'a@b.co', password: 'secret-pass' }, '10.0.0.2'));
    expect(vi.mocked(updateSession).mock.calls[0][0]).toMatchObject({ cartId: undefined });
  });

  it('Wrong password and unknown email return the identical 401 body', async () => {
    vi.mocked(signIn).mockRejectedValue(new InvalidCredentialsError());
    const wrong = await POST(req({ email: 'a@b.co', password: 'nope-nope' }, '10.0.0.3'));
    const unknown = await POST(req({ email: 'nobody@b.co', password: 'nope-nope' }, '10.0.0.3'));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'INVALID_CREDENTIALS' });
    expect(await unknown.json()).toEqual({ error: 'INVALID_CREDENTIALS' });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('Unexpected failures answer with the same 401 body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(signIn).mockRejectedValue(new Error('boom'));
    const res = await POST(req({ email: 'a@b.co', password: 'secret-pass' }, '10.0.0.4'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'INVALID_CREDENTIALS' });
  });

  it('Missing fields: same 401 body and commercetools is not called', async () => {
    const res = await POST(req({ email: 'a@b.co' }, '10.0.0.5'));
    expect(res.status).toBe(401);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('Rate limit: the 11th attempt in a minute is 429 with Retry-After', async () => {
    vi.mocked(signIn).mockRejectedValue(new InvalidCredentialsError());
    for (let i = 0; i < 10; i++) expect((await POST(req({ email: 'a@b.co', password: 'x-x-x-x-x' }, '10.9.9.9'))).status).toBe(401);
    const res = await POST(req({ email: 'a@b.co', password: 'x-x-x-x-x' }, '10.9.9.9'));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'RATE_LIMITED' });
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
