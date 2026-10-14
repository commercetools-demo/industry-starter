import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { countOpenOrders, listRecentOrders } from './orders';

const order = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `o${n}`,
  orderNumber: `ORD-${n}`,
  createdAt: '2026-10-10T10:00:00.000Z',
  orderState: 'Open',
  shipmentState: 'Pending',
  paymentState: 'Paid',
  shippingAddress: { firstName: 'Anna', lastName: 'Test' },
  totalPrice: { centAmount: 12345, currencyCode: 'EUR', fractionDigits: 2 },
  ...extra,
});

beforeEach(() => adminMock.reset());

describe('dashboard orders', () => {
  it('reads use the in-store endpoint of the session store, never project-level orders', async () => {
    adminMock.respond('orders', { results: [order(1)], total: 1 });
    await listRecentOrders('store-a');
    await countOpenOrders('store-a');
    const calls = adminMock.callsTo('orders');
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.scope).toBe('in-store');
      expect(call.storeKey).toBe('store-a');
    }
  });

  it('maps rows: number, first name with initial, money with fraction digits, chip', async () => {
    adminMock.respond('orders', { results: [order(1), order(2, { shipmentState: 'Shipped', shippingAddress: undefined })] });
    const rows = await listRecentOrders('store-a');
    expect(rows[0]).toMatchObject({ orderNumber: 'ORD-1', customer: 'Anna T.', chip: 'processing', total: { centAmount: 12345, currencyCode: 'EUR', fractionDigits: 2 } });
    expect(rows[1]).toMatchObject({ customer: '', chip: 'shipped' });
    expect(JSON.stringify(rows)).not.toContain('Test"');
  });

  it('newest first, limited, test orders excluded', async () => {
    adminMock.respond('orders', { results: [] });
    await listRecentOrders('store-a', 5);
    expect(adminMock.callsTo('orders')[0].queryArgs).toMatchObject({ sort: 'createdAt desc', limit: 5, where: expect.stringContaining('isTest') });
  });

  it('open orders count reads total with limit 1', async () => {
    adminMock.respond('orders', { results: [], total: 7 });
    expect(await countOpenOrders('store-a')).toBe(7);
    expect(adminMock.callsTo('orders')[0].queryArgs).toMatchObject({ limit: 1, withTotal: true, where: expect.stringContaining('orderState="Open"') });
  });

  it('a failing source rejects (the route turns it into 502)', async () => {
    adminMock.respond('orders', new Error('boom'));
    await expect(listRecentOrders('store-a')).rejects.toThrow('boom');
  });
});
