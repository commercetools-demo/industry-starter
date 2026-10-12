import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCopilotAction, resetCopilotActions } from '@/lib/portal/copilot';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  getPorts: () => m.seam.getPorts(),
}));

import { POST } from './route';
import { POST as PLAN } from '../plan/route';

const apply = vi.fn(async () => ({ ok: true, message: 'ok' }));
const post = (json: unknown) => POST(makeRequest('/api/copilot/apply', { method: 'POST', json }));
const viewer = (roles: ('admin' | 'buyer')[]) => ({ customerId: 'c1', name: 'N', email: 'e', roles, ctPermissions: [], businessUnitKey: 'bu', businessUnitName: 'x', storeKey: 's', storeName: 'y' });

beforeEach(() => {
  m = createSeamMock({ customerId: 'c1', businessUnitKey: 'bu', storeKey: 's' });
  apply.mockClear();
  resetCopilotActions();
  registerCopilotAction({ id: 'a', match: () => null, describe: () => 'x', apply, permission: 'discount.edit' });
});

describe('POST /api/copilot/apply', () => {
  it('an admin confirmation runs the action', async () => {
    m.ports.loadViewer.mockResolvedValue(viewer(['admin']));
    const res = await post({ actionId: 'a', params: { name: 'x' } });
    expect(res.status).toBe(200);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('a buyer is refused and nothing runs', async () => {
    m.ports.loadViewer.mockResolvedValue(viewer(['buyer']));
    const res = await post({ actionId: 'a', params: {} });
    expect(res.status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });

  it('planning proposes a confirm and changes nothing', async () => {
    registerCopilotAction({ id: 'p', match: (t) => (t === 'pause it' ? { params: { name: 'x' } } : null), describe: (p) => `Set '${p.name}' to inactive`, apply, permission: 'discount.edit' });
    m.ports.loadViewer.mockResolvedValue(viewer(['admin']));
    const res = await PLAN(makeRequest('/api/copilot/plan', { method: 'POST', json: { text: 'pause it', locale: 'en-US' } }));
    expect(await res.json()).toEqual({ kind: 'confirm', actionId: 'p', params: { name: 'x' }, summary: "Set 'x' to inactive" });
    expect(apply).not.toHaveBeenCalled();
  });

  it('planning needs a session', async () => {
    m.state.session = {};
    expect((await PLAN(makeRequest('/api/copilot/plan', { method: 'POST', json: { text: 'hi' } }))).status).toBe(401);
  });

  it('needs a session', async () => {
    m.state.session = {};
    expect((await post({ actionId: 'a' })).status).toBe(401);
  });
});
