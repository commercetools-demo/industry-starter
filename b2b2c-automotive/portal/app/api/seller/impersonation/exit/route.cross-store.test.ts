import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  getPorts: () => m.seam.getPorts(),
}));

const service = vi.hoisted(() => ({ endShopAs: vi.fn(async () => 1) }));
vi.mock('@/lib/ct/seller/impersonation', () => service);

import { POST } from './route';

const exit = () => POST(makeRequest('/api/seller/impersonation/exit', { method: 'POST' }));

beforeEach(() => {
  m = createSeamMock({ customerId: 'seller-1', businessUnitKey: 'bu', storeKey: 's1', actingAs: 'Test Driver' });
  service.endShopAs.mockClear();
});

describe('POST /api/seller/impersonation/exit', () => {
  it('needs a session and never calls commercetools', async () => {
    m.state.session = {};
    expect((await exit()).status).toBe(401);
    for (const port of Object.values(m.ports)) expect(port).not.toHaveBeenCalled();
    expect(m.state.writes).toBe(0);
  });

  it('drops actingAs and keeps the seller identity, without any commercetools call', async () => {
    const res = await exit();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(m.state.session).toEqual({ customerId: 'seller-1', businessUnitKey: 'bu', storeKey: 's1' });
    for (const port of Object.values(m.ports)) expect(port).not.toHaveBeenCalled();
  });

  it('marks the handoff records of this seller in the session store as ended (V-06) and survives a failure there', async () => {
    await exit();
    expect(service.endShopAs).toHaveBeenCalledWith('s1', 'seller-1');
    m = createSeamMock({ customerId: 'seller-1', businessUnitKey: 'bu', storeKey: 's1', actingAs: 'Test Driver' });
    service.endShopAs.mockRejectedValueOnce(new Error('down'));
    expect((await exit()).status).toBe(200);
    expect(m.state.session.actingAs).toBeUndefined();
  });
});
