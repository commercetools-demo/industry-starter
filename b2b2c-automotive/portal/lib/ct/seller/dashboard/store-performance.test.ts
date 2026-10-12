import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { clearStorePerformanceCache, loadStorePerformance } from './store-performance';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const money = (centAmount: number, currencyCode = 'EUR') => ({ centAmount, currencyCode, fractionDigits: 2 });
const line = (sku: string, name: string, quantity: number, cents: number) => ({ variant: { sku }, name: { 'en-US': name }, quantity, totalPrice: money(cents) });
const order = (id: string, createdAt: string, cents: number, lines: ReturnType<typeof line>[], extra: Record<string, unknown> = {}) => ({
  id,
  createdAt,
  orderState: 'Open',
  totalPrice: money(cents),
  lineItems: lines,
  ...extra,
});

beforeEach(() => {
  adminMock.reset();
  clearStorePerformanceCache();
});

describe('store performance', () => {
  it('sums, average, top five by revenue, truncated flag over five pages', async () => {
    adminMock.respond('orders', {
      total: 4,
      results: [
        order('a', '2026-10-12T09:00:00.000Z', 10000, [line('P1', 'Pad', 2, 6000), line('P2', 'Disc', 1, 4000)]),
        order('b', '2026-10-11T09:00:00.000Z', 5000, [line('P1', 'Pad', 1, 3000), line('P3', 'Filter', 1, 2000)]),
        // excluded: test order, cancelled, other currency
        order('t', '2026-10-11T10:00:00.000Z', 99900, [line('P9', 'Test', 1, 99900)], { custom: { fields: { isTest: true } } }),
        order('c', '2026-10-11T11:00:00.000Z', 88800, [line('P8', 'Cancelled', 1, 88800)], { orderState: 'Cancelled' }),
      ],
    });
    const p = await loadStorePerformance('store-a', 30, NOW);
    expect(p.sales).toEqual(money(15000));
    expect(p.orders).toBe(2);
    expect(p.averageOrder).toEqual(money(7500));
    expect(p.topProducts.map((t) => [t.sku, t.units, t.revenue.centAmount])).toEqual([
      ['P1', 3, 9000],
      ['P2', 1, 4000],
      ['P3', 1, 2000],
    ]);
    expect(p.daily).toHaveLength(30);
    expect(p.daily.at(-1)).toEqual({ date: '2026-10-12', sales: 10000 });
    expect(p.daily.at(-2)).toEqual({ date: '2026-10-11', sales: 5000 });
    expect(p.truncated).toBe(false);
    const call = adminMock.callsTo('orders')[0];
    expect(call).toMatchObject({ scope: 'in-store', storeKey: 'store-a' });
    expect(call.queryArgs).toMatchObject({ 'var.from': '2026-09-12T12:00:00.000Z', limit: 500 });
  });

  it('top five only, and the truncated flag is set after five full pages with more to come', async () => {
    const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => line(s, s, 1, 1000 - i));
    const page = Array.from({ length: 500 }, (_, i) => order(`o${i}`, '2026-10-12T00:00:00.000Z', 1000, i === 0 ? lines : []));
    adminMock.respond('orders', { total: 3000, results: page });
    const p = await loadStorePerformance('store-a', 30, NOW);
    expect(adminMock.callsTo('orders')).toHaveLength(5);
    expect(p.topProducts).toHaveLength(5);
    expect(p.truncated).toBe(true);
    expect(p.orders).toBe(2500);
  });

  it('no orders: zero sales, no average', async () => {
    adminMock.respond('orders', { total: 0, results: [] });
    const p = await loadStorePerformance('store-a', 30, NOW);
    expect(p).toMatchObject({ orders: 0, averageOrder: null, topProducts: [], truncated: false });
    expect(p.sales.centAmount).toBe(0);
  });

  it('is cached 60 s per store key and keys never mix', async () => {
    adminMock.respond('orders', { total: 0, results: [] });
    await loadStorePerformance('store-a', 30, NOW);
    await loadStorePerformance('store-a', 30, NOW);
    await loadStorePerformance('store-b', 30, NOW);
    expect(adminMock.callsTo('orders').map((c) => c.storeKey)).toEqual(['store-a', 'store-b']);
  });
});
