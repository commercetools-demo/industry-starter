// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getMarket: vi.fn(async () => ({ country: 'US', currency: 'USD', locale: 'en-US' })), updateSession: vi.fn() }));
vi.mock('@/lib/ct/auth', () => ({ createPasswordResetToken: vi.fn() }));

import { createPasswordResetToken } from '@/lib/ct/auth';
import { getLastResetLink } from '@/lib/dev-stub';
import { POST } from './route';

let n = 0;
const req = (body: unknown, ip = `40.0.0.${++n}`) =>
  new Request('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { __devResetLinks?: Map<string, string> }).__devResetLinks = new Map();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/auth/forgot-password', () => {
  it('Unknown email: the same { ok: true } as a known email', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(createPasswordResetToken).mockResolvedValueOnce('tok-1').mockResolvedValueOnce(null);
    const known = await POST(req({ email: 'known@b.co' }));
    const unknown = await POST(req({ email: 'nobody@b.co' }));
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });
  });

  it('Dev stub: in development the link is stored for the stub page', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(createPasswordResetToken).mockResolvedValue('tok 1');
    await POST(req({ email: 'known@b.co' }));
    expect(getLastResetLink()).toEqual({ email: 'known@b.co', url: 'http://localhost:3000/en-US/account/reset-password?token=tok%201' });
  });

  it('Dev stub: in development an unknown email stores nothing', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(createPasswordResetToken).mockResolvedValue(null);
    await POST(req({ email: 'nobody@b.co' }));
    expect(getLastResetLink()).toBeNull();
  });

  it('Dev stub: in production nothing is stored or logged', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createPasswordResetToken).mockResolvedValue('tok-1');
    const res = await POST(req({ email: 'known@b.co' }));
    expect(await res.json()).toEqual({ ok: true });
    expect(getLastResetLink()).toBeNull();
    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('A commercetools failure still answers { ok: true }', async () => {
    vi.mocked(createPasswordResetToken).mockRejectedValue(new Error('boom'));
    const res = await POST(req({ email: 'known@b.co' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('Missing email: still { ok: true } and no commercetools call', async () => {
    const res = await POST(req({}));
    expect(await res.json()).toEqual({ ok: true });
    expect(createPasswordResetToken).not.toHaveBeenCalled();
  });

  it('Rate limit: the 6th request in a minute is 429', async () => {
    for (let i = 0; i < 5; i++) expect((await POST(req({ email: 'a@b.co' }, '41.0.0.1'))).status).toBe(200);
    const res = await POST(req({ email: 'a@b.co' }, '41.0.0.1'));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'RATE_LIMITED' });
  });
});
