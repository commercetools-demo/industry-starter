// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { post, resetWorld, world } from '@/test/fixtures/checkoutWorld';

vi.mock('@/lib/ct/cart', async () => (await import('@/test/fixtures/checkoutWorld')).cartMock());
vi.mock('@/lib/ct/bundle', async () => (await import('@/test/fixtures/checkoutWorld')).bundleMock());
vi.mock('@/lib/ct/serviceability', async () => (await import('@/test/fixtures/checkoutWorld')).serviceabilityMock());
vi.mock('@/lib/ct/client', async () => (await import('@/test/fixtures/checkoutWorld')).clientMock());
vi.mock('@/lib/ct/devices', async () => (await import('@/test/fixtures/checkoutWorld')).devicesMock());
vi.mock('@/lib/ct/order-stamp', async () => (await import('@/test/fixtures/checkoutWorld')).stampMock());
vi.mock('@/lib/ct/checkout-session', async () => (await import('@/test/fixtures/checkoutWorld')).checkoutSessionMock());
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/checkoutWorld')).sessionMock());
vi.mock('@/lib/market/server', async () => (await import('@/test/fixtures/checkoutWorld')).marketMock());

import { POST } from './route';

const call = (orderId: string) => POST(post('/api/checkout/complete', { orderId }));
const hostedOrder = (cartId = 'cart-1') => ({ id: 'o1', orderNumber: 'MLV-AAAAAAAA', orderState: 'Open', createdAt: '2026-10-07T10:00:00Z', cart: { typeId: 'cart', id: cartId }, totalPrice: { centAmount: 8499, currencyCode: 'USD' }, lineItems: [] });

beforeEach(() => resetWorld({ signedIn: true, pendingOrderNumber: 'MLV-AAAAAAAA' }));

describe('POST /api/checkout/complete', () => {
  it('an order of another cart is refused with 403', async () => {
    world.orders.push(hostedOrder('someone-elses-cart'));
    const res = await call('o1');
    expect(res.status).toBe(403);
    expect(world.stamped).toEqual([]);
  });

  it('finalizes the order, remembers its number, clears the cart and the pending fields', async () => {
    world.orders.push(hostedOrder());
    const res = await call('o1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderNumber: 'MLV-AAAAAAAA' });
    expect(world.stamped).toEqual(['o1']);
    expect(world.session).toEqual({ customerId: 'cust-1', lastOrderNumber: 'MLV-AAAAAAAA' });
  });

  it('a second call answers the same number without work', async () => {
    world.orders.push(hostedOrder());
    await call('o1');
    world.stamped.length = 0;
    const again = await call('o1');
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ orderNumber: 'MLV-AAAAAAAA' });
    expect(world.stamped).toEqual([]);
  });

  it('a failing stamp still answers the order number (the confirmation page finalizes lazily)', async () => {
    world.orders.push(hostedOrder());
    const stamp = await import('@/lib/ct/order-stamp');
    vi.spyOn(stamp, 'stampOrderPricing').mockRejectedValueOnce(new Error('boom'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await call('o1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderNumber: 'MLV-AAAAAAAA' });
    quiet.mockRestore();
  });

  it('an unknown order id is 404 and a missing id is 400', async () => {
    expect((await call('nope')).status).toBe(404);
    expect((await POST(post('/api/checkout/complete', {}))).status).toBe(400);
  });
});
