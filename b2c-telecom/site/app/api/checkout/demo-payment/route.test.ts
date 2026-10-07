// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, post, resetWorld, world } from '@/test/fixtures/checkoutWorld';

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

const TOTAL = 8499;
const pay = (expectedTotalCents: unknown = TOTAL) => POST(post('/api/checkout/demo-payment', { expectedTotalCents }));

beforeEach(() => {
  vi.stubEnv('CHECKOUT_DEMO_PAYMENT', 'true');
  resetWorld({ signedIn: true });
  world.ct.customerEmail = 'qa-u1@example.com';
  world.ct.shippingAddress = { ...ADDRESS };
  world.ct.totalPrice = { centAmount: TOTAL, currencyCode: 'USD' };
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/checkout/demo-payment', () => {
  it('is 404 unless demo payment is on (production never fakes a payment)', async () => {
    vi.stubEnv('CHECKOUT_DEMO_PAYMENT', 'false');
    const res = await pay();
    expect(res.status).toBe(404);
    expect(world.orders).toEqual([]);
  });

  it('places one order from the cart with the reserved number, finalizes it and clears the cart', async () => {
    const res = await pay();
    expect(res.status).toBe(200);
    const { orderNumber } = await res.json();
    expect(orderNumber).toMatch(/^MLV-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(world.orders).toHaveLength(1);
    expect(world.orders[0]).toMatchObject({ orderNumber, paymentState: 'Paid' });
    expect(world.stamped).toEqual(['order-1']);
    expect(world.session.lastOrderNumber).toBe(orderNumber);
    expect(world.session.cartId).toBeUndefined();
    expect(world.session.pendingOrderNumber).toBeUndefined();
  });

  it('the same checks as the session route apply: a stale total places no order', async () => {
    const res = await pay(TOTAL - 1);
    expect(res.status).toBe(409);
    expect(world.orders).toEqual([]);
  });

  it('a duplicate order number answers 409 ALREADY_ORDERED instead of a second order', async () => {
    world.session.pendingOrderNumber = 'MLV-AAAAAAAA';
    world.session.pendingCartId = 'cart-1';
    world.orders.push({ id: 'o0', orderNumber: 'MLV-AAAAAAAA' });
    const res = await pay();
    expect(res.status).toBe(409);
    expect(world.orders).toHaveLength(1);
  });
});
