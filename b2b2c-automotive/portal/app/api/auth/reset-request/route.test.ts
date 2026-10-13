import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';
import { createSeamMock } from '@/test/portal-mocks';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  clearSession: () => m.seam.clearSession(),
  getPorts: () => m.seam.getPorts(),
}));

import { POST as resetRequest } from './route';
import { POST as reset } from '../reset/route';

const KNOWN_TOKEN = 'k'.repeat(32);
const ask = (email: string) => resetRequest(makeRequest('/api/auth/reset-request', { method: 'POST', json: { email } }));
const timed = async (email: string) => {
  const started = Date.now();
  const promise = ask(email);
  await vi.advanceTimersByTimeAsync(700);
  const res = await promise;
  return { res, elapsed: Date.now() - started };
};

beforeEach(() => {
  m = createSeamMock();
  m.ports.createPasswordToken.mockImplementation(async (email: string) => (email === 'known@example.com' ? KNOWN_TOKEN : null));
  vi.stubEnv('DEMO_ONSCREEN_RESET', 'true');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('POST /api/auth/reset-request', () => {
  it('known and unknown email respond with the same status and body shape', async () => {
    const known = await timed('known@example.com');
    const unknown = await timed('unknown@example.com');
    expect(known.res.status).toBe(200);
    expect(unknown.res.status).toBe(known.res.status);
    const a = await known.res.json();
    const b = await unknown.res.json();
    expect(Object.keys(b)).toEqual(Object.keys(a));
    expect(b.message).toBe(a.message);
    expect(a.resetPath).toMatch(/^\/de-DE\/reset\/[A-Za-z0-9_-]+$/);
    expect(b.resetPath.length).toBe(a.resetPath.length);
    expect(b.resetPath).not.toContain(KNOWN_TOKEN);
  });

  it('response time does not depend on existence', async () => {
    const known = await timed('known@example.com');
    const unknown = await timed('unknown@example.com');
    for (const { elapsed } of [known, unknown]) {
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThanOrEqual(700);
    }
  });

  it('unknown email creates no token; the decoy path fails at reset with the generic text', async () => {
    const { res } = await timed('unknown@example.com');
    const { resetPath } = await res.json();
    expect(m.ports.createPasswordToken).toHaveBeenCalledTimes(1);
    const token = resetPath.split('/').pop();
    const result = await reset(makeRequest('/api/auth/reset', { method: 'POST', json: { token, password: 'a-long-new-password' } }));
    expect(result.status).toBe(400);
    expect((await result.json()).error).toBe('This reset link is invalid or has expired.');
  });

  it('flag off gives 404 for the request and the reset', async () => {
    vi.stubEnv('DEMO_ONSCREEN_RESET', 'false');
    expect((await ask('known@example.com')).status).toBe(404);
    expect(m.ports.createPasswordToken).not.toHaveBeenCalled();
    const res = await reset(makeRequest('/api/auth/reset', { method: 'POST', json: { token: 'x'.repeat(32), password: 'a-long-new-password' } }));
    expect(res.status).toBe(404);
  });

  it('reset enforces the 12 character rule', async () => {
    const res = await reset(makeRequest('/api/auth/reset', { method: 'POST', json: { token: KNOWN_TOKEN, password: 'short' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 12 characters/);
    expect(m.ports.resetPassword).not.toHaveBeenCalled();
  });

  it('a valid token and password reset the account', async () => {
    m.ports.resetPassword.mockResolvedValue(true);
    const res = await reset(makeRequest('/api/auth/reset', { method: 'POST', json: { token: KNOWN_TOKEN, password: 'a-long-new-password' } }));
    expect(res.status).toBe(200);
    expect(m.ports.resetPassword).toHaveBeenCalledWith(KNOWN_TOKEN, 'a-long-new-password');
  });
});
