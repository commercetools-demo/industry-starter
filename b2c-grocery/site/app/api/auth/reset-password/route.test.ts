// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), updateSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/auth', () => ({ InvalidTokenError: class InvalidTokenError extends Error {}, resetPassword: vi.fn(), signIn: vi.fn() }));

import { InvalidTokenError, resetPassword, signIn } from '@/lib/ct/auth';
import { getSession, updateSession } from '@/lib/session';
import { POST } from './route';

const customer = { id: 'c-1', email: 'a@b.co', firstName: 'Ada', lastName: 'L', version: 4 };
let n = 0;
const req = (body: unknown, ip = `50.0.0.${++n}`) =>
  new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ cartId: 'anon' });
});

describe('POST /api/auth/reset-password', () => {
  it('Valid token: resets, signs in with the anonymous cart merged, answers { ok: true }', async () => {
    vi.mocked(resetPassword).mockResolvedValue(customer as never);
    vi.mocked(signIn).mockResolvedValue({ customer, cart: { id: 'merged', cartState: 'Active' } } as never);
    const res = await POST(req({ token: 'tok', password: 'new-password' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(resetPassword).toHaveBeenCalledWith('tok', 'new-password');
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'new-password', 'anon');
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c-1', cartId: 'merged' }), expect.anything());
  });

  it('Invalid or expired token: 400 INVALID_TOKEN and nobody is signed in', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new InvalidTokenError());
    const res = await POST(req({ token: 'old', password: 'new-password' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_TOKEN' });
    expect(signIn).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('Missing token: 400 INVALID_TOKEN without a commercetools call', async () => {
    const res = await POST(req({ password: 'new-password' }));
    expect(await res.json()).toEqual({ error: 'INVALID_TOKEN' });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('Weak password: 400 WEAK_PASSWORD', async () => {
    const res = await POST(req({ token: 'tok', password: 'short' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'WEAK_PASSWORD' });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('Sign-in after a successful reset fails: still { ok: true }, no session written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(resetPassword).mockResolvedValue(customer as never);
    vi.mocked(signIn).mockRejectedValue(new Error('boom'));
    const res = await POST(req({ token: 'tok', password: 'new-password' }));
    expect(await res.json()).toEqual({ ok: true });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('Rate limit: the 6th request in a minute is 429', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new InvalidTokenError());
    for (let i = 0; i < 5; i++) expect((await POST(req({ token: 't', password: 'new-password' }, '51.0.0.1'))).status).toBe(400);
    expect((await POST(req({ token: 't', password: 'new-password' }, '51.0.0.1'))).status).toBe(429);
  });
});
