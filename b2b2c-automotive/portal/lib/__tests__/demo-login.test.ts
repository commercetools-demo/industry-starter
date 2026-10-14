import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixturePorts, fixtureViewer } from '@/lib/portal/dev-fixtures';
import { visibleItems } from '@/lib/portal/nav';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  clearSession: () => m.seam.clearSession(),
  getPorts: () => m.seam.getPorts(),
}));

import { GET } from '@/app/api/auth/demo-accounts/route';
import { POST } from '@/app/api/auth/demo-login/route';

const get = () => GET(makeRequest('/api/auth/demo-accounts'));
const post = (json: unknown) => POST(makeRequest('/api/auth/demo-login', { method: 'POST', json }));
const hrefsOf = (roles: Parameters<typeof visibleItems>[0]) => visibleItems(roles).map((i) => i.href).sort();

beforeEach(() => {
  m = createSeamMock();
  // Use the fixture behaviour for the ports under test.
  m.ports.listDemoAccounts.mockImplementation(() => fixturePorts.listDemoAccounts());
  m.ports.loginDemo.mockImplementation((id: string) => fixturePorts.loginDemo(id));
  vi.stubEnv('DEMO_LOGIN_ENABLED', 'true');
});
afterEach(() => vi.unstubAllEnvs());

describe('demo login', () => {
  it('disabled returns 404', async () => {
    vi.stubEnv('DEMO_LOGIN_ENABLED', 'false');
    expect((await get()).status).toBe(404);
    expect((await post({ customerId: 'fx-cust-north-admin' })).status).toBe(404);
    expect(m.ports.listDemoAccounts).not.toHaveBeenCalled();
    expect(m.state.writes).toBe(0);
  });

  it('list contains only seeded demo associates, grouped and ordered Admin before Buyer', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { accounts } = await res.json();
    expect(accounts.map((a: { label: string }) => a.label)).toEqual([
      'Alex Admin · Admin · Test Garage Nord',
      'Bea Buyer · Buyer · Test Garage Nord',
      'Sam Admin · Admin · Test Garage Süd',
    ]);
    // the pending registrant is a real, non-demo user
    expect(JSON.stringify(accounts)).not.toContain('Pat Pending');
  });

  it('list never exposes email or password', async () => {
    m.ports.listDemoAccounts.mockResolvedValue([
      { id: 'c1', label: 'A · Admin · B', group: 'B', email: 'secret@example.com', password: 'hunter2-hunter2' },
    ]);
    const text = await (await get()).text();
    expect(text).not.toContain('secret@example.com');
    expect(text).not.toContain('hunter2');
    expect(JSON.parse(text)).toEqual({ accounts: [{ id: 'c1', label: 'A · Admin · B', group: 'B' }] });
  });

  it('unlisted associate id is refused with 403 and no session', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await post({ customerId: 'real-associate-id' });
    expect(res.status).toBe(403);
    expect(m.state.writes).toBe(0);
    expect(m.ports.loginDemo).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('demo-login denied');
    log.mockRestore();
  });

  it('a body without an id is a 400', async () => {
    expect((await post({})).status).toBe(400);
  });

  it('Admin demo sign-in gets Admin navigation', async () => {
    const res = await post({ customerId: 'fx-cust-north-admin' });
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(m.state.writes).toBe(1);
    const viewer = fixtureViewer(m.state.session)!;
    expect(viewer.roles).toEqual(['admin']);
    expect(hrefsOf(viewer.roles)).toHaveLength(15);
  });

  it('Buyer demo sign-in gets Buyer navigation', async () => {
    await post({ customerId: 'fx-cust-north-buyer' });
    const viewer = fixtureViewer(m.state.session)!;
    expect(viewer.roles).toEqual(['buyer']);
    expect(hrefsOf(viewer.roles)).toEqual(['/', '/account', '/catalog', '/company', '/returns', '/reviews']);
  });

  it('a failing sign-in answers 401 with no account detail', async () => {
    m.ports.listDemoAccounts.mockResolvedValue([{ id: 'c1', label: 'A · Admin · B', group: 'B' }]);
    m.ports.loginDemo.mockResolvedValue({ kind: 'invalid' });
    const res = await post({ customerId: 'c1' });
    expect(res.status).toBe(401);
    expect(m.state.writes).toBe(0);
    expect(JSON.stringify(await res.json())).not.toContain('c1');
  });
});
