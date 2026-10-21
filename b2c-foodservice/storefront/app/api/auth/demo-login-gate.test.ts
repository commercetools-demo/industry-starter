// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(async () => ({})) }));
vi.mock('@/lib/auth/login-flow', () => ({
  limitLogin: vi.fn(() => null),
  signInAndRespond: vi.fn(async () => Response.json({ ok: true })),
}));

import { GET as listCustomers } from '@/app/api/auth/demo-customers/route';
import { POST as demoLogin } from '@/app/api/auth/demo-login/route';

afterEach(() => vi.unstubAllEnvs());
const ctx = { params: Promise.resolve({}) };
const login = () =>
  demoLogin(
    new Request('http://x/api/auth/demo-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'mcf-customer-maya' }),
    }),
    ctx,
  );

describe('Demo sign-in gate', () => {
  it('Disabled: DEMO_LOGIN_ENABLED not true answers 404 on demo-login', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'false');
    expect((await login()).status).toBe(404);
    vi.stubEnv('DEMO_LOGIN_ENABLED', '');
    expect((await login()).status).toBe(404);
  });

  it('Enabled: a seeded key signs in through the shared login path', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'sentinel-demo-password-123');
    expect((await login()).status).toBe(200);
  });

  it('Nothing sensitive in the page: the list carries keys, names and markets, never an email or the password', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'sentinel-demo-password-123');
    const text = await (await listCustomers(new Request('http://x/api/auth/demo-customers'), ctx)).text();
    expect(text).toContain('Maya Okonkwo');
    expect(text).not.toContain('@');
    expect(text).not.toContain('sentinel-demo-password-123');
  });
});
