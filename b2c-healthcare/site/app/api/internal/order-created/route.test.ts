// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const orders = vi.hoisted(() => ({ finalizeOrder: vi.fn() }));
vi.mock('@/lib/ct/orders', () => orders);

import { POST } from './route';

const SECRET = 'a-secret-of-16-chars-or-more';
const post = (body: unknown, headers: Record<string, string> = {}) => POST(makeRequest('/api/internal/order-created', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));

beforeEach(() => {
  orders.finalizeOrder.mockReset().mockResolvedValue({ ok: true, replay: false, orderId: 'ord-1', orderNumber: 'MLV-000001' });
  vi.stubEnv('ORDER_FINALIZE_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('checkout: POST /api/internal/order-created, the finalize safety net (AA)', () => {
  it('finalizes the order with the secret and answers the outcome only, never the id or the number', async () => {
    const r = await post({ orderId: 'ord-1' }, { 'x-order-secret': SECRET });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ ok: true, replay: false });
    expect(orders.finalizeOrder).toHaveBeenCalledWith('ord-1');
  });

  it('accepts a commercetools message body and a Pub/Sub push envelope', async () => {
    await post({ resource: { typeId: 'order', id: 'ord-2' }, type: 'OrderCreated' }, { 'x-order-secret': SECRET });
    const data = Buffer.from(JSON.stringify({ resource: { typeId: 'order', id: 'ord-3' } })).toString('base64');
    await post({ message: { data } }, { 'x-order-secret': SECRET });
    expect(orders.finalizeOrder.mock.calls.map((c) => c[0])).toEqual(['ord-2', 'ord-3']);
  });

  it('a resource that is not an order, or no id, is a 400 and finalizes nothing', async () => {
    expect((await post({ resource: { typeId: 'cart', id: 'c1' } }, { 'x-order-secret': SECRET })).status).toBe(400);
    expect((await post({}, { 'x-order-secret': SECRET })).status).toBe(400);
    expect((await post({ orderId: 'a b/c' }, { 'x-order-secret': SECRET })).status).toBe(400);
    expect(orders.finalizeOrder).not.toHaveBeenCalled();
  });

  it('without the header or with a wrong one: 401 with no detail, and nothing runs', async () => {
    for (const headers of [{}, { 'x-order-secret': 'nope' }, { 'x-order-secret': `${SECRET}x` }] as Record<string, string>[]) {
      const r = await post({ orderId: 'ord-1' }, headers);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'Unauthorized.' });
    }
    expect(orders.finalizeOrder).not.toHaveBeenCalled();
  });

  it('without a configured (or with a too short) secret the route is disabled', async () => {
    vi.stubEnv('ORDER_FINALIZE_SECRET', '');
    expect((await post({ orderId: 'ord-1' }, { 'x-order-secret': '' })).status).toBe(503);
    vi.stubEnv('ORDER_FINALIZE_SECRET', 'short');
    expect((await post({ orderId: 'ord-1' }, { 'x-order-secret': 'short' })).status).toBe(503);
    expect(orders.finalizeOrder).not.toHaveBeenCalled();
  });

  it('a retryable failure answers 5xx so the queue redelivers; a refusal is final and acknowledged; an unknown order is 404', async () => {
    orders.finalizeOrder.mockResolvedValueOnce({ ok: false, code: 'IN_PROGRESS' });
    expect((await post({ orderId: 'ord-1' }, { 'x-order-secret': SECRET })).status).toBe(503);
    orders.finalizeOrder.mockResolvedValueOnce({ ok: false, code: 'DISPENSE_REFUSED' });
    expect((await post({ orderId: 'ord-1' }, { 'x-order-secret': SECRET })).status).toBe(200);
    orders.finalizeOrder.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' });
    expect((await post({ orderId: 'ord-1' }, { 'x-order-secret': SECRET })).status).toBe(404);
  });

  it('an unexpected error is a sanitized 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    orders.finalizeOrder.mockRejectedValueOnce(new Error('secret-detail'));
    const r = await post({ orderId: 'ord-1' }, { 'x-order-secret': SECRET });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('secret-detail');
  });
});
