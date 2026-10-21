// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ getProfile: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), isInvalidCurrentPassword: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/customer', () => ct);

import { POST as PASSWORD } from '@/app/api/account/password/route';
import { GET, PATCH } from '@/app/api/account/profile/route';
import { AppError } from '@/lib/errors';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const req = (url: string, method: string, body?: unknown) => new Request(`http://x${url}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const PROFILE = { firstName: 'Mia', lastName: 'Okonkwo', email: 'maya@example.com', phone: null, defaultShippingAddressId: 'a1' };

beforeEach(async () => {
  jar.store.clear();
  resetRateLimits();
  for (const f of Object.values(ct)) f.mockReset();
  ct.isInvalidCurrentPassword.mockImplementation((e: { wrong?: boolean }) => Boolean(e?.wrong));
  ct.updateProfile.mockResolvedValue(PROFILE);
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1', customerEmail: 'maya@example.com', customerFirstName: 'Maya' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/account/profile', () => {
  it('401 with no detail', async () => {
    jar.store.clear();
    for (const res of [await GET(req('/api/account/profile', 'GET'), ctx), await PATCH(req('/api/account/profile', 'PATCH', {}), ctx), await PASSWORD(req('/api/account/password', 'POST', {}), ctx)]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
    }
  });

  it('PATCH saves the names, ignores an email in the body and refreshes the greeting in the session cookie', async () => {
    const res = await PATCH(req('/api/account/profile', 'PATCH', { firstName: ' Mia ', lastName: 'Okonkwo', email: 'evil@example.com' }), ctx);
    expect(res.status).toBe(200);
    expect(ct.updateProfile).toHaveBeenCalledWith('c1', { firstName: 'Mia', lastName: 'Okonkwo' });
    const token = /malva-session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
    expect(await verifySessionToken(token)).toMatchObject({ customerId: 'c1', customerFirstName: 'Mia' });
  });

  it.each([
    [{ firstName: '' }, { firstName: 'required' }],
    [{ lastName: 'x'.repeat(61) }, { lastName: 'too_long' }],
    [{ phone: 'call me' }, { phone: 'invalid' }],
    [{ defaultShippingAddressId: 'a b' }, { defaultShippingAddressId: 'invalid' }],
  ])('refuses %j with field codes and writes nothing', async (body, fields) => {
    const res = await PATCH(req('/api/account/profile', 'PATCH', body), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields).toEqual(fields);
    expect(ct.updateProfile).not.toHaveBeenCalled();
  });

  it('Phone disabled with no address: the server answers phone no_address', async () => {
    ct.updateProfile.mockRejectedValue(new AppError('validation_failed', 422));
    const res = await PATCH(req('/api/account/profile', 'PATCH', { phone: '+1 555 0100' }), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields).toEqual({ phone: 'no_address' });
  });
});

describe('POST /api/account/password', () => {
  const body = (over: Record<string, unknown> = {}) => ({ currentPassword: 'old-pass-1', newPassword: 'new-pass-22', ...over });

  it('changes the password', async () => {
    const res = await PASSWORD(req('/api/account/password', 'POST', body()), ctx);
    expect(res.status).toBe(200);
    expect(ct.changePassword).toHaveBeenCalledWith('c1', 'old-pass-1', 'new-pass-22');
  });

  it('Password change checks the policy first: commercetools is never called for a weak password', async () => {
    const res = await PASSWORD(req('/api/account/password', 'POST', body({ newPassword: 'short' })), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'password_policy', failed: expect.arrayContaining(['min_length', 'digit']) });
    expect(ct.changePassword).not.toHaveBeenCalled();
  });

  it('a password equal to the email name is refused by the policy', async () => {
    const res = await PASSWORD(req('/api/account/password', 'POST', body({ newPassword: 'maya@example.com' })), ctx);
    expect((await res.json()).error.failed).toContain('not_email');
  });

  it('Wrong current password gives the specific message', async () => {
    ct.changePassword.mockRejectedValue({ wrong: true });
    const res = await PASSWORD(req('/api/account/password', 'POST', body()), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('current_password_invalid');
  });

  it('Password change is rate limited, and the answer carries retryAfterSeconds', async () => {
    ct.changePassword.mockRejectedValue({ wrong: true });
    for (let i = 0; i < 5; i += 1) await PASSWORD(req('/api/account/password', 'POST', body()), ctx);
    const res = await PASSWORD(req('/api/account/password', 'POST', body()), ctx);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) });
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('never echoes a password, and a missing field is a 400', async () => {
    const res = await PASSWORD(req('/api/account/password', 'POST', { newPassword: 'new-pass-22' }), ctx);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('new-pass-22');
  });
});
