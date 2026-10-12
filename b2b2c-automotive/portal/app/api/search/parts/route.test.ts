import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  getPorts: () => m.seam.getPorts(),
}));

import { GET } from './route';
import { GET as getNotifications } from '../../notifications/route';

const get = (q: string) => GET(makeRequest(`/api/search/parts?q=${encodeURIComponent(q)}`));

beforeEach(() => {
  m = createSeamMock({ customerId: 'c1', businessUnitKey: 'bu', storeKey: 's1' });
  m.ports.searchParts.mockResolvedValue([{ sku: 'A-1', name: 'Part' }]);
  m.ports.shippedOrders.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1' }]);
});

describe('search and notification routes', () => {
  it('1 character returns nothing and never calls the search', async () => {
    expect(await (await get('b')).json()).toEqual({ parts: [] });
    expect(m.ports.searchParts).not.toHaveBeenCalled();
  });

  it('two characters search the session store', async () => {
    expect(await (await get('br')).json()).toEqual({ parts: [{ sku: 'A-1', name: 'Part' }] });
    expect(m.ports.searchParts).toHaveBeenCalledWith('s1', 'br');
  });

  it('search needs a session', async () => {
    m.state.session = {};
    expect((await get('brake')).status).toBe(401);
    expect(m.ports.searchParts).not.toHaveBeenCalled();
  });

  it('notifications list the shipped orders, no-store', async () => {
    const res = await getNotifications();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).notifications).toEqual([
      { id: 'order-shipped:o1', kind: 'order-shipped', values: { order: 'ORD-1' }, href: '/returns' },
    ]);
  });

  it('notifications need a session', async () => {
    m.state.session = {};
    expect((await getNotifications()).status).toBe(401);
  });
});
