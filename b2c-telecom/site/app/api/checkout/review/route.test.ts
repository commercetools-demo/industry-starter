// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, feeLine, get, phoneLine, planLine, resetWorld, world } from '@/test/fixtures/checkoutWorld';

vi.mock('@/lib/ct/cart', async () => (await import('@/test/fixtures/checkoutWorld')).cartMock());
vi.mock('@/lib/ct/bundle', async () => (await import('@/test/fixtures/checkoutWorld')).bundleMock());
vi.mock('@/lib/ct/serviceability', async () => (await import('@/test/fixtures/checkoutWorld')).serviceabilityMock());
vi.mock('@/lib/ct/client', async () => (await import('@/test/fixtures/checkoutWorld')).clientMock());
vi.mock('@/lib/ct/devices', async () => (await import('@/test/fixtures/checkoutWorld')).devicesMock());
vi.mock('@/lib/ct/order-stamp', async () => (await import('@/test/fixtures/checkoutWorld')).stampMock());
vi.mock('@/lib/ct/checkout-session', async () => (await import('@/test/fixtures/checkoutWorld')).checkoutSessionMock());
vi.mock('@/lib/ct/customer', async () => (await import('@/test/fixtures/checkoutWorld')).customerMock());
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/checkoutWorld')).sessionMock());
vi.mock('@/lib/market/server', async () => (await import('@/test/fixtures/checkoutWorld')).marketMock());

import { GET } from './route';

beforeEach(() => {
  resetWorld({ lines: [planLine(), phoneLine(), feeLine()], signedIn: true });
  world.ct.shippingAddress = { ...ADDRESS };
});

describe('GET /api/checkout/review', () => {
  it('answers the cart state with the totals the cart reports, the contract total of the committed plan and a service start', async () => {
    const res = await GET(get('/api/checkout/review'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { review } = await res.json();
    expect(review.dueToday).toEqual(review.state.cart.summary.total);
    expect(review.dueToday.centAmount).toBe(5999 + 5500 + 2500);
    expect(review.contractTotal).toEqual({ centAmount: 143976, currencyCode: 'USD' });
    expect(review.monthlyAfterToday.centAmount).toBe(5999 + 5500);
    expect(review.serviceStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('no cart: 400 NO_CART', async () => {
    world.ct.cartState = 'Ordered';
    expect((await GET(get('/api/checkout/review'))).status).toBe(400);
  });
});
