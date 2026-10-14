import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { countOpenReturns, listReturnsToHandle, returnStatus } from './returns';

const item = (id: string, status: string | undefined, extra: Record<string, unknown> = {}) => ({
  id,
  quantity: 2,
  lineItemId: 'li1',
  shipmentState: 'Initial',
  ...(status ? { custom: { fields: { status, returnNumber: `RET-${id}` } } } : {}),
  ...extra,
});

const orders = {
  results: [
    {
      id: 'o1',
      orderNumber: 'ORD-1',
      shippingAddress: { firstName: 'Anna', lastName: 'Test' },
      lineItems: [{ id: 'li1', name: { 'de-DE': 'Bremsscheibe', 'en-US': 'Brake disc' } }],
      returnInfo: [{ returnTrackingId: 'trk', items: [item('r1', 'requested'), item('r2', 'received'), item('r3', 'refunded'), item('r4', 'inspected'), item('r5', 'in-transit')] }],
    },
    {
      // no custom type: the native shipment state stands in
      id: 'o2',
      orderNumber: 'ORD-2',
      lineItems: [{ id: 'li1', name: { 'de-DE': 'Ölfilter' } }],
      returnInfo: [{ returnTrackingId: 'trk2', items: [item('n1', undefined, { shipmentState: 'Advised' }), item('n2', undefined, { shipmentState: 'Initial' })] }],
    },
  ],
};

beforeEach(() => adminMock.reset());

describe('dashboard returns', () => {
  it('counts open statuses, tolerates a missing custom type, one orders call for the whole list', async () => {
    adminMock.respond('orders', orders);
    // requested, in-transit, received, inspected (4) plus the native Advised one (1); refunded and the untyped Initial one do not count
    expect(await countOpenReturns('store-a')).toBe(5);
    expect(adminMock.callsTo('orders')).toHaveLength(1);
    const rows = await listReturnsToHandle('store-a');
    expect(adminMock.callsTo('orders')).toHaveLength(2);
    expect(rows.map((r) => r.returnNumber)).toEqual(['RET-r1', 'RET-r2', 'trk2']);
    expect(rows.every((r) => ['requested', 'received'].includes(r.status))).toBe(true);
    expect(adminMock.callsTo('orders')[0]).toMatchObject({ scope: 'in-store', storeKey: 'store-a' });
    expect(adminMock.callsTo('orders')[0].queryArgs.where).toContain('returnInfo is not empty');
  });

  it('row carries order number, first name with initial and the item with quantity', async () => {
    adminMock.respond('orders', orders);
    const [row] = await listReturnsToHandle('store-a');
    expect(row).toMatchObject({ orderNumber: 'ORD-1', customer: 'Anna T.', items: [{ quantity: 2, name: { 'en-US': 'Brake disc' } }] });
  });

  it('limit applies after filtering', async () => {
    adminMock.respond('orders', orders);
    expect(await listReturnsToHandle('store-a', 1)).toHaveLength(1);
  });

  it('status mapping', () => {
    expect(returnStatus({ shipmentState: 'Returned' })).toBe('received');
    expect(returnStatus({ custom: { fields: { status: 'bogus' } } as never, shipmentState: 'Initial' })).toBeNull();
  });
});
