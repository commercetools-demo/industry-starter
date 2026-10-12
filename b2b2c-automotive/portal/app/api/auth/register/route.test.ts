import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';
import { createSeamMock } from '@/test/portal-mocks';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  clearSession: () => m.seam.clearSession(),
  getPorts: () => m.seam.getPorts(),
}));

import { POST } from './route';

const valid = { companyName: 'Test Garage Nord', name: 'Alex Test', email: 'New.User@Example.com', password: 'twelve-chars-ok' };
const post = (json: unknown) => POST(makeRequest('/api/auth/register', { method: 'POST', json }));

beforeEach(() => {
  m = createSeamMock();
});

describe('POST /api/auth/register', () => {
  it('success creates the account and starts no session', async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'created', message: 'Account created. Awaiting Malva approval of your business.' });
    expect(m.ports.register).toHaveBeenCalledWith({ ...valid, email: 'new.user@example.com' });
    expect(m.state.writes).toBe(0);
  });

  it('password shorter than 12 characters refused with the rule', async () => {
    const res = await post({ ...valid, password: 'eleven-char' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 12 characters/i);
    expect(m.ports.register).not.toHaveBeenCalled();
  });

  it('company name and email are validated', async () => {
    expect((await post({ ...valid, companyName: 'A' })).status).toBe(400);
    expect((await post({ ...valid, email: 'not-an-email' })).status).toBe(400);
    expect(m.ports.register).not.toHaveBeenCalled();
  });

  it('duplicate email answers 400 with the generic text', async () => {
    m.ports.register.mockResolvedValue('duplicate');
    const res = await post(valid);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("We couldn't create that account. Try signing in.");
  });

  it('second concurrent call for same email creates nothing', async () => {
    let release: (v: 'created') => void = () => undefined;
    m.ports.register.mockImplementation(() => new Promise((resolve) => (release = resolve as typeof release)));
    const first = post(valid);
    await vi.waitFor(() => expect(m.ports.register).toHaveBeenCalledTimes(1));
    const second = await post({ ...valid, email: 'NEW.user@example.com' });
    expect(second.status).toBe(400);
    expect(m.ports.register).toHaveBeenCalledTimes(1);
    release('created');
    expect((await first).status).toBe(200);
  });
});
