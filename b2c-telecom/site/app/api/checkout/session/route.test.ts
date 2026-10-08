// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, feeLine, planLine, post, resetWorld, world } from '@/test/fixtures/checkoutWorld';
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

import { POST } from './route';

const TOTAL = 8499; // plan 5999 + activation fee 2500, no shipping
const start = (expectedTotalCents: unknown = TOTAL) => POST(post('/api/checkout/session', { expectedTotalCents }));
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

/** A signed-in buyer whose bundle has contact and address on the cart. */
function ready() {
  resetWorld({ signedIn: true });
  world.ct.customerEmail = 'qa-u1@example.com';
  world.ct.shippingAddress = { ...ADDRESS };
  world.ct.totalPrice = { centAmount: TOTAL, currencyCode: 'USD' };
}

beforeEach(() => {
  vi.stubEnv('CHECKOUT_DEMO_PAYMENT', 'false');
  vi.stubEnv('CTP_CHECKOUT_APP_KEY', 'app-key');
  ready();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/checkout/session', () => {
  it('no cart: 400 NO_CART and no session', async () => {
    world.ct.cartState = 'Ordered';
    const res = await start();
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('NO_CART');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a cart that was just ordered answers 409 ALREADY_ORDERED with the number', async () => {
    world.session.pendingOrderNumber = 'MLV-AAAAAAAA';
    world.orders.push({ id: 'o1', orderNumber: 'MLV-AAAAAAAA' });
    world.ct.cartState = 'Ordered';
    const res = await start();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'ALREADY_ORDERED', details: { orderNumber: 'MLV-AAAAAAAA' } });
  });

  it('empty cart: 400 EMPTY_CART', async () => {
    world.ct.lineItems = [];
    expect(await code(await start())).toBe('EMPTY_CART');
  });

  it('a body without a whole expected total: 400 INVALID_BODY', async () => {
    const res = await start('5000');
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('INVALID_BODY');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('missing contact, address, delivery: 422 with the first missing code', async () => {
    delete world.ct.customerEmail;
    expect(await code(await start())).toBe('NO_CONTACT');
    world.ct.customerEmail = 'a@b.co';
    delete world.ct.shippingAddress;
    expect(await code(await start())).toBe('NO_ADDRESS');
    resetWorld({ signedIn: true, lines: [planLine(), feeLine(), planLine({ id: 'E1', kind: 'equipment', schedule: null, label: null })] });
    world.ct.customerEmail = 'a@b.co';
    world.ct.shippingAddress = { ...ADDRESS };
    expect(await code(await start(TOTAL + 5999))).toBe('NO_DELIVERY');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a signed-in buyer gets the customer own email on the cart once, so contact is complete', async () => {
    delete world.ct.customerEmail;
    world.customerEmail = 'qa-u1@example.com';
    expect((await start()).status).toBe(200);
    expect(world.ct.customerEmail).toBe('qa-u1@example.com');
    expect(world.actions.flat().filter((a) => a.action === 'setCustomerEmail')).toHaveLength(1);
  });

  it('a guest with monthly items: 401 SIGN_IN_REQUIRED, no session', async () => {
    resetWorld();
    world.ct.customerEmail = 'g@example.com';
    world.ct.shippingAddress = { ...ADDRESS };
    const res = await start();
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('SIGN_IN_REQUIRED');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a service address that cannot be served: 422 NOT_SERVICEABLE and no session', async () => {
    world.unservableZips.add('10001');
    expect(await code(await start())).toBe('NOT_SERVICEABLE');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('eligibility lost before checkout: 422 ELIGIBILITY_LOST and no session', async () => {
    world.eligibilityIssue = true;
    const res = await start();
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('ELIGIBILITY_LOST');
    expect(body.error.details.reasons).toEqual(['NOT_ELIGIBLE_AUDIENCE']);
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a device price that fell back to the one-time price: 422 DEVICE_PRICE_INVALID and no session', async () => {
    world.deviceIntegrityFails = true;
    expect(await code(await start())).toBe('DEVICE_PRICE_INVALID');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('Totals moved after authorization: stale expected total answers 409 and creates no session', async () => {
    const res = await start(TOTAL - 1000);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('TOTAL_CHANGED');
    expect(body.error.details.total).toEqual({ centAmount: TOTAL, currencyCode: 'USD' });
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a declined financing decision: 422 FINANCING_DECLINED and no session', async () => {
    world.lines = [planLine(), feeLine(), planLine({ id: 'D1', kind: 'device', schedule: null, label: null, acquisition: { mode: 'installments', termMonths: 24 } as never })];
    world.financing = 'declined';
    world.ct.shippingInfo = { shippingMethod: { typeId: 'shipping-method', id: 'sm-standard' }, shippingMethodName: 'Standard shipping', price: { centAmount: 0, currencyCode: 'USD' } };
    world.ct.totalPrice = { centAmount: 8499 + 5999, currencyCode: 'USD' };
    const res = await start(8499 + 5999);
    expect(res.status).toBe(422);
    expect(await code(res)).toBe('FINANCING_DECLINED');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('success: a hosted session for the cart with the reserved order number, no secrets, no payment strategy written', async () => {
    const res = await start();
    expect(res.status).toBe(200);
    const { session } = await res.json();
    expect(session).toMatchObject({ mode: 'hosted', flow: 'payment', sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' });
    expect(session.orderNumber).toMatch(/^MLV-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(world.sessionsCreated).toEqual([{ cartId: 'cart-1', orderNumber: session.orderNumber }]);
    expect(Object.keys(session)).not.toContain('token');
    expect(JSON.stringify(world.actions)).not.toContain('Recurring');
    expect(world.session).toMatchObject({ pendingOrderNumber: session.orderNumber, pendingCartId: 'cart-1', pendingTotalCents: String(TOTAL) });
    expect(world.calls).toContain('recalculate');
  });

  it('Placement fails at the last moment: second session reuses the pending order number', async () => {
    const first = (await (await start()).json()).session.orderNumber;
    const second = (await (await start()).json()).session.orderNumber;
    expect(second).toBe(first);
    expect(world.sessionsCreated.map((s) => s.orderNumber)).toEqual([first, first]);
  });

  it('a different cart gets a new order number', async () => {
    world.session.pendingOrderNumber = 'MLV-AAAAAAAA';
    world.session.pendingCartId = 'other-cart';
    const { session } = await (await start()).json();
    expect(session.orderNumber).not.toBe('MLV-AAAAAAAA');
  });

  it('without a Checkout application in development the demo marker is answered and no session is created', async () => {
    vi.stubEnv('CHECKOUT_DEMO_PAYMENT', 'true');
    const { session } = await (await start()).json();
    expect(session.mode).toBe('demo');
    expect(world.sessionsCreated).toEqual([]);
  });

  it('a digital-only bundle needs no delivery', async () => {
    resetWorld({ signedIn: true, lines: [planLine({ kind: 'addon', technology: null }), addonLine()] });
    world.ct.customerEmail = 'a@b.co';
    world.ct.shippingAddress = { ...ADDRESS };
    const total = 5999 + 999;
    world.ct.totalPrice = { centAmount: total, currencyCode: 'USD' };
    expect((await start(total)).status).toBe(200);
  });
});
