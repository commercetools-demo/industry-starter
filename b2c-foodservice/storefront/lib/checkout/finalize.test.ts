import type { Order } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctLine } from '@/test/cart';

const h = vi.hoisted(() => ({ order: null as unknown, byNumber: vi.fn(), ensure: vi.fn() }));
vi.mock('@/lib/ct/orders', () => ({
  getOrderById: vi.fn(async () => h.order),
  getOrderByNumber: h.byNumber,
  ensureOrderState: h.ensure,
}));

import { finalizeOrder, finalizeWithPolling } from './finalize';

const order = (over: Record<string, unknown> = {}) =>
  ({
    id: 'o1', version: 1, orderNumber: 'MC-ABCDEFGHJK', createdAt: '2026-10-21T10:00:00Z', locale: 'en-US', lineItems: [ctLine({ id: 'l', sku: 'A' })],
    totalPrice: { centAmount: 1000, currencyCode: 'USD' }, ...over,
  }) as unknown as Order;

beforeEach(() => {
  h.order = order();
  h.byNumber.mockReset();
  h.byNumber.mockImplementation(async () => h.order);
  h.ensure.mockReset();
  h.ensure.mockImplementation(async (o: Order) => ({ ...o, state: { obj: { key: 'mcf-order-ordered' } } }));
});

describe('finalizeOrder', () => {
  it('Finalize clears the way: the order gets the ordered state', async () => {
    const v = await finalizeOrder({ orderNumber: 'MC-ABCDEFGHJK' });
    expect(v?.state).toBe('ordered');
    expect(h.ensure).toHaveBeenCalledTimes(1);
  });
  it('Finalize is idempotent', async () => {
    const a = await finalizeOrder({ orderId: 'o1' });
    const b = await finalizeOrder({ orderId: 'o1' });
    expect(a).toEqual(b);
  });
  it('Failing post-order hook does not fail the order', async () => {
    const ran: string[] = [];
    const v = await finalizeOrder({ orderId: 'o1' }, new Date(), [
      async () => {
        throw new Error('boom');
      },
      async (o) => {
        ran.push(o.id);
      },
    ]);
    expect(v?.id).toBe('o1');
    expect(ran).toEqual(['o1']);
  });
  it('is null for an unknown order', async () => {
    h.byNumber.mockResolvedValue(null);
    expect(await finalizeOrder({ orderNumber: 'MC-ZZZZZZZZZZ' })).toBeNull();
  });
});

describe('finalizeWithPolling', () => {
  it('Placement outcome unknown looks the order up by number, up to 5 times, 1 s apart', async () => {
    h.byNumber.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(h.order);
    const sleeps: number[] = [];
    const v = await finalizeWithPolling({ orderNumber: 'MC-ABCDEFGHJK' }, { attempts: 5, delayMs: 1000, sleep: async (ms) => void sleeps.push(ms) });
    expect(v?.orderNumber).toBe('MC-ABCDEFGHJK');
    expect(h.byNumber).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 1000]);
  });
  it('gives up after the attempts and says nothing was found', async () => {
    h.byNumber.mockResolvedValue(null);
    const sleeps: number[] = [];
    expect(await finalizeWithPolling({ orderNumber: 'MC-ZZZZZZZZZZ' }, { attempts: 3, delayMs: 10, sleep: async (ms) => void sleeps.push(ms) })).toBeNull();
    expect(h.byNumber).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });
});
