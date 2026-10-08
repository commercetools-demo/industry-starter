// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, feeLine, get, planLine, post, resetWorld, world } from '@/test/fixtures/checkoutWorld';
import { addonLine } from '@/test/fixtures/cart';

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

import { GET, POST } from './route';

const equipment = () => planLine({ id: 'E1', kind: 'equipment', offerKey: 'malva-offer-router', sku: 'MLV-EQP-1', name: 'Router', chargeType: 'recurring', schedule: null, label: null, technology: null, family: null });

beforeEach(() => {
  resetWorld({ lines: [planLine(), feeLine(), equipment()] });
  world.ct.shippingAddress = { ...ADDRESS };
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/checkout/delivery', () => {
  it('lists the platform matching methods, Malva methods only, with the returned prices', async () => {
    const res = await GET(get('/api/checkout/delivery'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsDelivery).toBe(true);
    expect(body.options.map((o: { key: string }) => o.key)).toEqual(['malva-shipping-standard']);
    expect(body.options[0].price).toEqual({ centAmount: 0, currencyCode: 'USD' });
  });

  it('selecting a listed method writes setShippingMethod and returns the state with the method', async () => {
    const res = await POST(post('/api/checkout/delivery', { shippingMethodId: 'sm-standard' }));
    expect(res.status).toBe(200);
    expect((await res.json()).state.delivery).toMatchObject({ id: 'sm-standard', name: 'Standard shipping' });
  });

  it('a method that is not in the matching list: 422 before any cart write', async () => {
    const res = await POST(post('/api/checkout/delivery', { shippingMethodId: 'sm-sample' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('SHIPPING_METHOD_NOT_AVAILABLE');
    expect(world.actions).toEqual([]);
  });

  it('a digital-only bundle sets the digital method once and answers needsDelivery false', async () => {
    resetWorld({ lines: [planLine({ kind: 'addon', technology: null }), addonLine()] });
    world.ct.shippingAddress = { ...ADDRESS };
    const first = await (await GET(get('/api/checkout/delivery'))).json();
    expect(first.needsDelivery).toBe(false);
    expect(first.options).toEqual([]);
    expect(first.state.delivery.id).toBe('sm-digital');
    await GET(get('/api/checkout/delivery'));
    expect(world.actions.length).toBe(1);
  });

  it('no address yet: 422 NO_ADDRESS', async () => {
    delete world.ct.shippingAddress;
    const res = await GET(get('/api/checkout/delivery'));
    expect(res.status).toBe(422);
  });

  it('DEV_FORCE_NO_DELIVERY is honoured only in development', async () => {
    vi.stubEnv('DEV_FORCE_NO_DELIVERY', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    expect((await (await GET(get('/api/checkout/delivery'))).json()).options).toEqual([]);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await (await GET(get('/api/checkout/delivery'))).json()).options.length).toBe(1);
  });
});
