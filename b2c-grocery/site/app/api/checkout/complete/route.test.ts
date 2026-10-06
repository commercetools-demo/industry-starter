// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/orders', () => ({ getOrderRef: vi.fn() }));
const confirmBooking = vi.fn();
vi.mock('@/lib/slots', () => ({ getSlotService: () => ({ confirmBooking }) }));

import { POST } from './route';
import { getOrderRef } from '@/lib/ct/orders';
import { getSession, updateSession } from '@/lib/session';

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/checkout/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
  vi.mocked(getOrderRef).mockResolvedValue({ id: 'order-1', cartId: 'cart-1', slotId: '20261013-10' });
  vi.mocked(updateSession).mockResolvedValue({});
  confirmBooking.mockResolvedValue(undefined);
});

describe('POST /api/checkout/complete', () => {
  it('Successful payment: remembers lastOrderId, drops cartId, confirms the booking with the cart id', async () => {
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderId: 'order-1' });
    expect(updateSession).toHaveBeenCalledWith({ lastOrderId: 'order-1', cartId: undefined }, expect.anything());
    expect(confirmBooking).toHaveBeenCalledWith('20261013-10', 'order-1', 'cart-1');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('Cart mismatch: 403, session untouched, no booking', async () => {
    vi.mocked(getOrderRef).mockResolvedValue({ id: 'order-1', cartId: 'someone-elses' });
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(403);
    expect(updateSession).not.toHaveBeenCalled();
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it('Slot confirmation: a failing booking is tolerated and logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    confirmBooking.mockRejectedValue(new Error('down'));
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(200);
    expect(updateSession).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('order without slot: no booking call', async () => {
    vi.mocked(getOrderRef).mockResolvedValue({ id: 'order-1', cartId: 'cart-1' });
    expect((await post({ orderId: 'order-1' })).status).toBe(200);
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it('second call for the same order (cart already removed) is idempotent and does no work', async () => {
    vi.mocked(getSession).mockResolvedValue({ lastOrderId: 'order-1' });
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderId: 'order-1' });
    expect(getOrderRef).not.toHaveBeenCalled();
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it('no cart and a different last order: 400 NO_CART', async () => {
    vi.mocked(getSession).mockResolvedValue({ lastOrderId: 'other' });
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'NO_CART' });
  });

  it('missing order id: 400; unknown order: 404', async () => {
    expect((await post({})).status).toBe(400);
    vi.mocked(getOrderRef).mockResolvedValue(null);
    expect((await post({ orderId: 'nope' })).status).toBe(404);
  });

  it('lookup failure: 500 CHECKOUT_ERROR and the session is untouched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getOrderRef).mockRejectedValue(new Error('boom'));
    const res = await post({ orderId: 'order-1' });
    expect(res.status).toBe(500);
    expect(updateSession).not.toHaveBeenCalled();
  });
});
