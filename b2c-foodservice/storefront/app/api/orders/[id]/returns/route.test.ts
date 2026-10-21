// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ getCustomerOrderById: vi.fn(), addReturn: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/orders', () => ct);

import { POST } from '@/app/api/orders/[id]/returns/route';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import { ctLine, ctOrder } from '@/test/orders';

const recent = () => new Date(Date.now() - 2 * 86400000).toISOString();
const delivered = (over: Record<string, unknown> = {}) =>
  ctOrder({ shipmentState: 'Delivered', lastModifiedAt: recent(), lineItems: [ctLine('l1', { quantity: 3 }), ctLine('l2', { quantity: 1 })], ...over });
const call = (body: unknown, id = 'o1') =>
  POST(new Request(`http://x/api/orders/${id}/returns`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  jar.store.clear();
  for (const f of Object.values(ct)) f.mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
  ct.getCustomerOrderById.mockResolvedValue(delivered());
  ct.addReturn.mockResolvedValue(delivered({ returnInfo: [{ returnDate: recent(), items: [{ id: 'r', type: 'LineItemReturnItem', lineItemId: 'l1', quantity: 2, shipmentState: 'Advised', paymentState: 'Initial' }] }] }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/orders/[id]/returns', () => {
  it('Return started: the update carries the line ids, quantities and the reason', async () => {
    const res = await call({ items: [{ lineId: 'l1', quantity: 2, reason: 'damaged' }] });
    expect(res.status).toBe(200);
    expect(ct.addReturn).toHaveBeenCalledWith('o1', [{ lineId: 'l1', quantity: 2, reason: 'Damaged' }]);
    const { order } = await res.json();
    expect(order.returns[0].items[0]).toMatchObject({ lineId: 'l1', quantity: 2, shipmentState: 'Advised' });
  });

  it('a shopper cannot return more than remains', async () => {
    ct.getCustomerOrderById.mockResolvedValue(
      delivered({ returnInfo: [{ items: [{ id: 'r', type: 'LineItemReturnItem', lineItemId: 'l1', quantity: 2, shipmentState: 'Advised', paymentState: 'Initial' }] }] }),
    );
    const res = await call({ items: [{ lineId: 'l1', quantity: 2 }] });
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields).toEqual({ 'items.0': 'quantity_exceeds_returnable' });
    expect(ct.addReturn).not.toHaveBeenCalled();
  });

  it.each([
    [{ items: [] }, 'items'],
    [{ items: [{ lineId: 'zzz', quantity: 1 }] }, 'items.0'],
    [{ items: [{ lineId: 'l1', quantity: 0 }] }, 'items.0'],
    [{ items: [{ lineId: 'l1', quantity: 1.5 }] }, 'items.0'],
    [{ items: [{ lineId: 'l1', quantity: 1 }, { lineId: 'l1', quantity: 1 }] }, 'items.1'],
    [{ items: [{ lineId: 'l1', quantity: 1, reason: '<script>' }] }, 'items.0'],
    [null, 'items'],
  ])('refuses %j with 422', async (body, field) => {
    const res = await call(body);
    expect(res.status).toBe(422);
    expect(Object.keys((await res.json()).error.fields)).toContain(field);
    expect(ct.addReturn).not.toHaveBeenCalled();
  });

  it('Return window closed is refused', async () => {
    ct.getCustomerOrderById.mockResolvedValue(delivered({ lastModifiedAt: '2025-01-01T00:00:00.000Z' }));
    const res = await call({ items: [{ lineId: 'l1', quantity: 1 }] });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('return_window_closed');
    expect(ct.addReturn).not.toHaveBeenCalled();
  });

  it('Order not completed is not returnable', async () => {
    ct.getCustomerOrderById.mockResolvedValue(delivered({ shipmentState: 'Shipped' }));
    const res = await call({ items: [{ lineId: 'l1', quantity: 1 }] });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('not_returnable');
  });

  it("Return of another customer's order is 404, identical to an unknown order", async () => {
    ct.getCustomerOrderById.mockResolvedValue(null);
    const foreign = await call({ items: [{ lineId: 'l1', quantity: 1 }] }, 'o-foreign');
    const unknown = await call({ items: [{ lineId: 'l1', quantity: 1 }] }, 'nope');
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
    expect(ct.addReturn).not.toHaveBeenCalled();
  });

  it('401 without a session', async () => {
    jar.store.clear();
    expect((await call({ items: [] })).status).toBe(401);
  });
});
