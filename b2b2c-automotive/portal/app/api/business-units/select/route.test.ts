import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  clearSession: () => m.seam.clearSession(),
  getPorts: () => m.seam.getPorts(),
}));

import { GET as getUnits } from '../route';
import { GET as getCurrent } from '../current/route';
import { POST } from './route';

const units = [
  { key: 'bu-hh', name: 'Test Garage Nord Hamburg', kind: 'Division', stores: [{ key: 's-online', name: 'DACH Online', mode: 'FromParent' }] },
  { key: 'bu-be', name: 'Test Garage Nord Berlin', kind: 'Division', stores: [{ key: 's-direct', name: 'Workshop Direct', mode: 'Explicit' }] },
];
const signedIn = { customerId: 'c1', businessUnitKey: 'bu-hh', storeKey: 's-online', distributionChannelId: 'd', supplyChannelId: 'i', productSelectionId: 'p', accountGroupIds: [], cartId: 'cart-1', locale: 'de-DE' as const, currency: 'EUR', country: 'DE' };
const post = (json: unknown) => POST(makeRequest('/api/business-units/select', { method: 'POST', json }));

beforeEach(() => {
  m = createSeamMock(signedIn);
  m.ports.listUnits.mockResolvedValue(units);
  m.ports.resolveContext.mockImplementation(async (_s: unknown, bu: string, store?: string) =>
    bu === 'bu-be' ? { businessUnitKey: 'bu-be', storeKey: store ?? 's-direct', distributionChannelId: 'd2', supplyChannelId: 'i2', productSelectionId: 'p2', accountGroupIds: [] } : null,
  );
});

describe('business unit routes', () => {
  it('switch writes fields atomically, clears cartId', async () => {
    const res = await post({ businessUnitKey: 'bu-be' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ businessUnitKey: 'bu-be', storeKey: 's-direct', label: 'Test Garage Nord Berlin · Workshop Direct', name: 'Test Garage Nord Berlin' });
    expect(m.state.writes).toBe(1);
    expect(m.state.session).toMatchObject({ businessUnitKey: 'bu-be', storeKey: 's-direct', distributionChannelId: 'd2', supplyChannelId: 'i2', productSelectionId: 'p2' });
    expect(m.state.session.cartId).toBeUndefined();
    expect(m.state.session.customerId).toBe('c1');
  });

  it("rejects unit that is not the user's", async () => {
    const res = await post({ businessUnitKey: 'bu-other' });
    expect(res.status).toBe(404);
    expect(m.state.writes).toBe(0);
    expect(m.ports.resolveContext).not.toHaveBeenCalled();
  });

  it('a store the unit does not list is rejected', async () => {
    expect((await post({ businessUnitKey: 'bu-be', storeKey: 's-online' })).status).toBe(404);
    expect(m.state.writes).toBe(0);
  });

  it('needs a signed-in session', async () => {
    m.state.session = {};
    expect((await post({ businessUnitKey: 'bu-be' })).status).toBe(401);
    expect(m.ports.listUnits).not.toHaveBeenCalled();
  });

  it('GET /api/business-units lists units and the current choice, no-store', async () => {
    const res = await getUnits();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ current: { businessUnitKey: 'bu-hh', storeKey: 's-online' }, units });
  });

  it('GET /api/business-units/current returns roles and permissions, no-store', async () => {
    m.ports.loadViewer.mockResolvedValue({ customerId: 'c1', name: 'N', email: 'e', roles: ['buyer'], ctPermissions: ['ViewMyOrders'], businessUnitKey: 'bu-hh', businessUnitName: 'x', storeKey: 's-online', storeName: 'y' });
    const res = await getCurrent();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ businessUnitKey: 'bu-hh', storeKey: 's-online', roles: ['buyer'], ctPermissions: ['ViewMyOrders'] });
  });

  it('current without a signed-in unit is 401', async () => {
    m.state.session = { customerId: 'c1', pending: true };
    expect((await getCurrent()).status).toBe(401);
  });
});
