// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountError } from '@/lib/account/errors';
import { makeRequest } from '@/test/request';

const h = vi.hoisted(() => ({ register: vi.fn(), token: vi.fn(), reset: vi.fn(), session: { storeKey: 'mau-reseller-north' } as { storeKey?: string } }));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session, getLocale: async () => ({ locale: 'en-US', currency: 'EUR', country: 'DE' }) }));
vi.mock('@/lib/ct/account-customer', () => ({ registerCustomer: h.register, requestPasswordResetToken: h.token, resetPassword: h.reset }));
vi.mock('@/lib/auth/login', () => ({ clientKey: (r: Request) => r.headers.get('x-forwarded-for') ?? 'unknown' }));

const post = (path: string, body: unknown, ip = '1.1.1.1') => makeRequest(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
const REAL = 'Qm9ULW4tVHJ1ZS1Ub2tlbi1WYWx1ZS0xMjM0NTY3ODkwYWJj';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const m of [h.register, h.token, h.reset]) m.mockReset();
  h.session = { storeKey: 'mau-reseller-north' };
});

describe('POST /api/auth/register', () => {
  const good = { email: 'new@example.com', password: 'correct horse battery', firstName: 'N', lastName: 'M', marketingConsent: false };
  it('signs the new customer in and answers the login shape', async () => {
    h.register.mockResolvedValue({ customer: { id: 'c1' }, count: 2 });
    const { POST } = await import('./register/route');
    const res = await POST(post('/api/auth/register', good));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customer: { id: 'c1' }, count: 2 });
    expect(h.register).toHaveBeenCalledWith('mau-reseller-north', expect.objectContaining({ email: 'new@example.com', marketingConsent: false }));
  });
  it('consent defaults to false when the body omits it', async () => {
    h.register.mockResolvedValue({ customer: { id: 'c1' }, count: 0 });
    const { POST } = await import('./register/route');
    await POST(post('/api/auth/register', { email: 'a@example.com', password: 'correct horse battery' }));
    expect(h.register.mock.calls[0][1].marketingConsent).toBe(false);
  });
  it('400 on bad body', async () => {
    const { POST } = await import('./register/route');
    expect((await POST(post('/api/auth/register', { email: 'not-an-email', password: 'x' }))).status).toBe(400);
    expect(h.register).not.toHaveBeenCalled();
  });
  it('a weak password answers the rule name', async () => {
    h.register.mockRejectedValue(new AccountError('weak-password', 400, 'too-short'));
    const { POST } = await import('./register/route');
    const res = await POST(post('/api/auth/register', good));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'weak-password', rule: 'too-short' });
  });
  it('a duplicate email answers the generic body', async () => {
    h.register.mockRejectedValue(new AccountError('register-failed'));
    const { POST } = await import('./register/route');
    const res = await POST(post('/api/auth/register', good));
    expect(await res.json()).toEqual({ error: 'register-failed' });
  });
  it('rate limited', async () => {
    h.register.mockResolvedValue({ customer: { id: 'c1' }, count: 0 });
    const { POST } = await import('./register/route');
    for (let i = 0; i < 5; i += 1) expect((await POST(post('/api/auth/register', good, '9.9.9.9'))).status).toBe(200);
    expect((await POST(post('/api/auth/register', good, '9.9.9.9'))).status).toBe(429);
  });
  it('404 without a store in the session', async () => {
    h.session = {};
    const { POST } = await import('./register/route');
    expect((await POST(post('/api/auth/register', good))).status).toBe(404);
  });
});

describe('POST /api/auth/forgot-password', () => {
  const ask = (email = 'anna@example.com', ip = '2.2.2.2') => post('/api/auth/forgot-password', { email }, ip);

  it('known email returns a reset path with a real token', async () => {
    h.token.mockResolvedValue(REAL);
    const { POST } = await import('./forgot-password/route');
    const res = await POST(ask());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, demo: true, resetPath: `/en-US/mau-reseller-north/account/reset-password?token=${REAL}` });
    expect(h.token).toHaveBeenCalledWith('mau-reseller-north', 'anna@example.com');
  });

  it('unknown email returns the same shape and status with a decoy', async () => {
    h.token.mockResolvedValueOnce(REAL).mockResolvedValueOnce(null);
    const { POST } = await import('./forgot-password/route');
    const known = await POST(ask('anna@example.com'));
    const unknown = await POST(ask('nobody@example.com'));
    expect(unknown.status).toBe(known.status);
    const a = await known.json();
    const b = await unknown.json();
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    const token = (p: string) => new URL(p, 'http://x').searchParams.get('token') ?? '';
    expect(token(b.resetPath)).toHaveLength(token(a.resetPath).length);
    expect(token(b.resetPath)).not.toBe(REAL);
    expect(b.resetPath).toMatch(/^\/en-US\/mau-reseller-north\/account\/reset-password\?token=[A-Za-z0-9_-]+$/);
  });

  it('rate limited per email returns the same shape', async () => {
    h.token.mockResolvedValue(REAL);
    const { POST } = await import('./forgot-password/route');
    for (let i = 0; i < 5; i += 1) await POST(ask('anna@example.com', `3.3.3.${i}`));
    const limited = await POST(ask('anna@example.com', '3.3.3.99'));
    expect(limited.status).toBe(200);
    const body = await limited.json();
    expect(Object.keys(body).sort()).toEqual(['demo', 'ok', 'resetPath']);
    expect(body.resetPath).not.toContain(REAL);
    expect(h.token).toHaveBeenCalledTimes(5);
  });

  it('flag off returns no reset path', async () => {
    vi.stubEnv('DEMO_ONSCREEN_RESET', 'false');
    const { POST } = await import('./forgot-password/route');
    const res = await POST(ask());
    expect(await res.json()).toEqual({ ok: true });
    expect(h.token).not.toHaveBeenCalled();
  });

  it('token never appears in logs', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info')];
    h.token.mockResolvedValue(REAL);
    const { POST } = await import('./forgot-password/route');
    await POST(ask());
    h.token.mockResolvedValue(null);
    await POST(ask('nobody@example.com'));
    const logged = spies.flatMap((s) => s.mock.calls).flat().join(' ');
    expect(logged).not.toContain(REAL);
    expect(logged).not.toContain('anna@example.com');
    expect(logged).not.toContain('nobody@example.com');
  });

  it('the answer sets no cookie', async () => {
    h.token.mockResolvedValue(REAL);
    const { POST } = await import('./forgot-password/route');
    expect((await POST(ask())).headers.get('set-cookie')).toBeNull();
  });
});

describe('POST /api/auth/reset-password', () => {
  const reset = (body: unknown = { token: REAL, password: 'correct horse battery' }) => post('/api/auth/reset-password', body, '4.4.4.4');

  it('reset success answers ok and creates no session', async () => {
    h.reset.mockResolvedValue(undefined);
    const { POST } = await import('./reset-password/route');
    const res = await POST(reset());
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(h.reset).toHaveBeenCalledWith('mau-reseller-north', REAL, 'correct horse battery');
  });
  it('reset with bad token gives generic 400', async () => {
    h.reset.mockRejectedValue(new AccountError('invalid-token'));
    const { POST } = await import('./reset-password/route');
    const res = await POST(reset());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-token' });
  });
  it('reset weak password names rule', async () => {
    h.reset.mockRejectedValue(new AccountError('weak-password', 400, 'too-common'));
    const { POST } = await import('./reset-password/route');
    expect(await (await POST(reset())).json()).toEqual({ error: 'weak-password', rule: 'too-common' });
  });
  it('is not available when the flag is off', async () => {
    vi.stubEnv('DEMO_ONSCREEN_RESET', 'false');
    const { POST } = await import('./reset-password/route');
    expect((await POST(reset())).status).toBe(404);
  });
});
