// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest } from '@/test/request';

const login = vi.fn();
vi.mock('@/lib/ct/identity', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/identity')>()), login: (a: unknown) => login(a) }));
vi.mock('@/lib/attach-guest-bookings', () => ({ attachAfterSignIn: vi.fn() }));
const updateSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: async () => ({}), updateSession: (p: unknown) => updateSession(p) }));

import { POST } from './route';

const user = { id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@example.com', isEmailVerified: true };
beforeEach(() => {
  login.mockReset().mockResolvedValue({ user, cartId: undefined });
  updateSession.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/auth/demo-login', () => {
  it('is a 404 when DEMO_LOGIN_PASSWORD is not set', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', '');
    const res = await POST(makeJsonRequest('/api/auth/demo-login', { slug: 'sam-rivera' }));
    expect(res.status).toBe(404);
    expect(login).not.toHaveBeenCalled();
  });
  it('is a 404 for an unknown slug (no arbitrary email can be signed in)', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'long-enough-pass');
    const res = await POST(makeJsonRequest('/api/auth/demo-login', { slug: 'admin' }));
    expect(res.status).toBe(404);
    expect(login).not.toHaveBeenCalled();
  });
  it('signs in the demo patient with the server-side password and never returns it', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'long-enough-pass');
    const res = await POST(makeJsonRequest('/api/auth/demo-login', { slug: 'sam-rivera' }));
    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalledWith(expect.objectContaining({ email: 'sam.rivera@example.com', password: 'long-enough-pass' }));
    expect(updateSession).toHaveBeenCalledWith({ customerId: 'c1', cartId: undefined });
    expect(await res.text()).not.toContain('long-enough-pass');
  });
});
