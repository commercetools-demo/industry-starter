// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => {
  class WrongPasswordError extends Error {}
  return { deleteCustomerAccount: vi.fn(), WrongPasswordError };
});
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/customer', () => ct);

import { POST } from '@/app/api/account/delete/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const call = (body?: unknown) => POST(new Request('http://x/api/account/delete', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), ctx);

beforeEach(async () => {
  jar.store.clear();
  resetRateLimits();
  ct.deleteCustomerAccount.mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/account/delete', () => {
  it('401 with no detail', async () => {
    jar.store.clear();
    const res = await call({ confirmPassword: 'x' });
    expect(res.status).toBe(401);
    expect(ct.deleteCustomerAccount).not.toHaveBeenCalled();
  });

  it('Delete account refuses without a password and deletes nothing', async () => {
    for (const body of [undefined, {}, { confirmPassword: '' }, { confirmPassword: 42 }]) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('current_password_invalid');
    }
    expect(ct.deleteCustomerAccount).not.toHaveBeenCalled();
  });

  it('Delete account: a wrong password is 400 and the session is kept', async () => {
    ct.deleteCustomerAccount.mockRejectedValue(new ct.WrongPasswordError());
    const res = await call({ confirmPassword: 'nope' });
    expect(res.status).toBe(400);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('Delete account: success deletes the signed-in customer only and clears the session cookie', async () => {
    ct.deleteCustomerAccount.mockResolvedValue(undefined);
    const res = await call({ confirmPassword: 'right-pass-1', customerId: 'someone-else' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(ct.deleteCustomerAccount).toHaveBeenCalledWith('c1', 'right-pass-1');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/malva-session=;/);
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it('is rate limited after five tries', async () => {
    ct.deleteCustomerAccount.mockRejectedValue(new ct.WrongPasswordError());
    for (let i = 0; i < 5; i += 1) await call({ confirmPassword: 'nope' });
    const res = await call({ confirmPassword: 'nope' });
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('rate_limited');
  });

  it('never echoes the password', async () => {
    ct.deleteCustomerAccount.mockRejectedValue(new ct.WrongPasswordError());
    expect(JSON.stringify(await (await call({ confirmPassword: 'secret-pw-123' })).json())).not.toContain('secret-pw-123');
  });
});
