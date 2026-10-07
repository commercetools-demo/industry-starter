// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fx from '@/lib/offers/__fixtures__/offers';

const ordersExecute = vi.fn();
const ordersGet = vi.fn((...args: [{ queryArgs: Record<string, unknown> }]) => ({ execute: ordersExecute, args }));
const recurringExecute = vi.fn();
const recurringGet = vi.fn((...args: [{ queryArgs: Record<string, unknown> }]) => ({ execute: recurringExecute, args }));
vi.mock('./client', () => ({ getApiRoot: () => ({ orders: () => ({ get: ordersGet }), recurringOrders: () => ({ get: recurringGet }) }) }));
const labels: string[] = [];
vi.mock('./timeout', () => ({
  withTimeout: (promise: Promise<unknown>, label: string) => {
    labels.push(label);
    return promise;
  },
}));

import { getHoldings, resetHoldingsLogForTests } from './holdings';

const byKey = fx.offersByKey();

beforeEach(() => {
  vi.clearAllMocks();
  labels.length = 0;
  resetHoldingsLogForTests();
  ordersExecute.mockResolvedValue({ body: { results: [] } });
  recurringExecute.mockResolvedValue({ body: { results: [] } });
});

describe('getHoldings', () => {
  it('queries orders with the sanitized customer id, newest first, at most 100', async () => {
    await getHoldings('cust"1\\', byKey);
    expect(ordersGet).toHaveBeenCalledWith({ queryArgs: { where: 'customerId="cust1"', sort: 'createdAt desc', limit: 100 } });
    expect(recurringGet).toHaveBeenCalledWith({ queryArgs: { where: 'customer(id="cust1")', sort: 'createdAt desc', limit: 100, expand: ['cart'] } });
  });

  it('reads the offer key from the line custom field, then from productKey, and skips cancelled orders', async () => {
    ordersExecute.mockResolvedValue({
      body: {
        results: [
          { id: 'o1', orderNumber: 'MLV-1', orderState: 'Confirmed', lineItems: [{ productKey: 'ignored', custom: { fields: { offerKey: 'malva-offer-cable-500' } } }, { productKey: 'malva-offer-phone-plus' }] },
          { id: 'o2', orderNumber: 'MLV-2', orderState: 'Cancelled', lineItems: [{ productKey: 'malva-offer-cable-100' }] },
        ],
      },
    });
    expect(await getHoldings('c1', byKey)).toEqual([
      { offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'order', reference: 'MLV-1' },
      { offerKey: 'malva-offer-phone-plus', offerName: 'Plus', source: 'order', reference: 'MLV-1' },
    ]);
  });

  it('reads recurring order lines from the expanded cart and prefers them over orders', async () => {
    ordersExecute.mockResolvedValue({ body: { results: [{ id: 'o1', orderNumber: 'MLV-1', orderState: 'Confirmed', lineItems: [{ productKey: 'malva-offer-wireless-5g' }] }] } });
    recurringExecute.mockResolvedValue({
      body: {
        results: [
          { id: 'RO-1', recurringOrderState: 'Active', cart: { obj: { lineItems: [{ productKey: 'malva-offer-wireless-5g' }] } } },
          { id: 'RO-2', recurringOrderState: 'Canceled', cart: { obj: { lineItems: [{ productKey: 'malva-offer-cable-100' }] } } },
        ],
      },
    });
    expect(await getHoldings('c1', byKey)).toEqual([{ offerKey: 'malva-offer-wireless-5g', offerName: 'Air 5G', source: 'recurring-order', reference: 'RO-1' }]);
  });

  it('a 403 on recurring orders degrades to orders only and logs once; other errors are thrown', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    ordersExecute.mockResolvedValue({ body: { results: [{ id: 'o1', orderNumber: 'MLV-1', orderState: 'Open', lineItems: [{ productKey: 'malva-offer-cable-100' }] }] } });
    recurringExecute.mockRejectedValue({ statusCode: 403 });
    expect((await getHoldings('c1', byKey)).map((held) => held.offerKey)).toEqual(['malva-offer-cable-100']);
    await getHoldings('c1', byKey);
    expect(log).toHaveBeenCalledTimes(1);
    recurringExecute.mockRejectedValue({ statusCode: 500 });
    await expect(getHoldings('c1', byKey)).rejects.toEqual({ statusCode: 500 });
  });

  it('wraps both reads in withTimeout', async () => {
    await getHoldings('c1', byKey);
    expect([...labels].sort()).toEqual(['holdings.orders', 'holdings.recurring-orders']);
  });

  it('is not cached across requests (no unstable_cache, no module-level result store)', () => {
    const source = readFileSync(path.join(__dirname, 'holdings.ts'), 'utf8');
    expect(source).not.toMatch(/unstable_cache/);
    expect(source).not.toMatch(/new Map\(/);
  });
});
