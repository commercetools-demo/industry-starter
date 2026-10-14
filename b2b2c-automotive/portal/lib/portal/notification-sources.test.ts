import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeamMock } from '@/test/portal-mocks';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({ getPorts: () => m.seam.getPorts() }));

import { loadNotifications, notificationSources, registerNotificationSource } from './notification-sources';

beforeEach(() => {
  m = createSeamMock();
});

describe('notification sources', () => {
  it('order shipped source lists shipped store orders linking to the order', async () => {
    m.ports.shippedOrders.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1' }]);
    expect(await loadNotifications({ customerId: 'c', storeKey: 's' })).toEqual([
      { id: 'order-shipped:o1', kind: 'order-shipped', values: { order: 'ORD-1' }, href: '/returns' },
    ]);
  });

  it('customer return received is a stub that returns nothing until V registers it', async () => {
    const stub = notificationSources().find((s) => s.id === 'return-received')!;
    expect(await stub.load({})).toEqual([]);
  });

  it('a registered source is merged and a failing source does not break the list', async () => {
    registerNotificationSource({ id: 'boom', load: async () => Promise.reject(new Error('x')) });
    registerNotificationSource({ id: 'extra', load: async () => [{ id: 'e1', kind: 'return-received', values: { ref: 'R1' }, href: '/returns' }] });
    const list = await loadNotifications({ customerId: 'c' });
    expect(list.map((n) => n.id)).toEqual(['e1']);
  });
});
