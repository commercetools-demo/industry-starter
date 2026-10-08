import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/ct/client', () => ({ apiRoot: { orders: () => ({ get: (a: unknown) => ({ execute: () => get(a) }) }) } }));

import { getOrderForCustomer, listOrdersForCustomer } from './orders-read';
import { statusOfState } from '@/lib/mappers/order';

const money = (centAmount: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount, fractionDigits: 2 });
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 'MLV-000001',
  createdAt: '2026-10-08T10:00:00Z',
  customerId: 'c1',
  state: { obj: { key: 'mlv-received' } },
  totalPrice: money(1800),
  taxedPrice: { totalGross: money(1875) },
  lineItems: [{ name: { 'en-US': 'Atorvastatin 20 mg' }, quantity: 2 }],
  shippingAddress: { streetName: '1 Main St', city: 'Albany', state: 'NY', postalCode: '12207' },
  shippingInfo: { shippingMethod: { obj: { key: 'mlv-standard' } } },
  ...over,
});

beforeEach(() => get.mockReset().mockResolvedValue({ body: { results: [] } }));

describe('order-confirmation-page: getOrderForCustomer', () => {
  it('queries by id and customer id, and maps the order from itself (gross total, names only)', async () => {
    get.mockResolvedValue({ body: { results: [order()] } });
    const o = await getOrderForCustomer('o1', 'c1', 'en-US');
    expect(get.mock.calls[0]?.[0].queryArgs.where).toBe('id="o1" and customerId="c1"');
    expect(o).toMatchObject({ id: 'o1', orderNumber: 'MLV-000001', status: 'received', total: { centAmount: 1875 }, deliverTo: '1 Main St, Albany, NY 12207', sameDay: false, cancellable: true, lines: [{ name: 'Atorvastatin 20 mg', quantity: 2 }] });
  });

  it("Other patient's order: foreign and unknown ids both answer null", async () => {
    expect(await getOrderForCustomer('foreign', 'c1', 'en-US')).toBeNull();
    expect(await getOrderForCustomer('nope', 'c1', 'en-US')).toBeNull();
  });

  it('a malformed id never reaches the platform', async () => {
    expect(await getOrderForCustomer('o1" or id!="', 'c1', 'en-US')).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('order-history: listOrdersForCustomer', () => {
  it('Own orders only: queries by customerId, newest first', async () => {
    get.mockResolvedValue({ body: { results: [order({ id: 'o2' }), order()] } });
    const list = await listOrdersForCustomer('c"1', 'en-US');
    expect(get.mock.calls[0]?.[0].queryArgs).toMatchObject({ where: 'customerId="c1"', sort: 'createdAt desc' });
    expect(list.map((o) => o.id)).toEqual(['o2', 'o1']);
  });
});

describe('status mapping', () => {
  it.each([
    ['mlv-pharmacist-review', 'pharmacist-review'],
    ['mlv-cancelled', 'cancelled'],
    [undefined, 'received'],
    ['other', 'received'],
  ])('%s -> %s', (key, status) => {
    expect(statusOfState(key)).toBe(status);
  });

  it('same-day, shipment state and refund come from the order', async () => {
    get.mockResolvedValue({
      body: {
        results: [
          order({
            state: { obj: { key: 'mlv-cancelled' } },
            shipmentState: 'Partial',
            shippingInfo: { shippingMethod: { obj: { key: 'mlv-same-day' } } },
            paymentInfo: { payments: [{ obj: { transactions: [{ type: 'Authorization', state: 'Success' }, { type: 'Refund', state: 'Initial' }] } }] },
          }),
        ],
      },
    });
    expect(await getOrderForCustomer('o1', 'c1', 'en-US')).toMatchObject({ status: 'cancelled', shipmentState: 'Partial', sameDay: true, refund: 'requested', cancellable: false });
  });
});
