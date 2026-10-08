// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDRESS, post, resetWorld, world } from '@/test/fixtures/checkoutWorld';

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

const call = (body: unknown) => POST(post('/api/checkout/details', body));

beforeEach(() => resetWorld());

describe('POST /api/checkout/details', () => {
  it('invalid email: 400 INVALID_EMAIL and nothing is written', async () => {
    const res = await call({ email: 'bad' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_EMAIL');
    expect(world.actions).toEqual([]);
  });

  it('a valid email is written with setCustomerEmail and the cart is read back', async () => {
    const res = await call({ email: 'guest1@example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { state } = await res.json();
    expect(state.email).toBe('guest1@example.com');
    expect(world.actions[0]).toEqual([{ action: 'setCustomerEmail', email: 'guest1@example.com' }]);
  });

  it('invalid address fields: 400 INVALID_ADDRESS with the field codes, no write', async () => {
    const res = await call({ serviceAddress: { ...ADDRESS, postalCode: '12' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_ADDRESS');
    expect(body.error.details.fields.postalCode).toBe('invalidPostalCode');
    expect(world.actions).toEqual([]);
  });

  it('country other than the market: 422 COUNTRY_MISMATCH', async () => {
    const res = await call({ serviceAddress: { ...ADDRESS, country: 'DE', postalCode: '10115', state: undefined } });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('COUNTRY_MISMATCH');
  });

  it('billing the same: one address object goes to shipping and billing', async () => {
    const res = await call({ email: 'a@b.co', serviceAddress: ADDRESS });
    expect(res.status).toBe(200);
    const actions = world.actions[0] as { action: string; address?: Record<string, unknown> }[];
    const shipping = actions.find((a) => a.action === 'setShippingAddress')?.address;
    const billing = actions.find((a) => a.action === 'setBillingAddress')?.address;
    expect(shipping).toMatchObject({ streetName: '1 Main St', postalCode: '10001', email: 'a@b.co' });
    expect(billing).toEqual(shipping);
  });

  it('billing different: the second address goes to billing only', async () => {
    await call({ serviceAddress: ADDRESS, billingAddress: { ...ADDRESS, streetName: '9 Other Rd', postalCode: '10002' } });
    const actions = world.actions[0] as { action: string; address?: Record<string, unknown> }[];
    expect(actions.find((a) => a.action === 'setBillingAddress')?.address).toMatchObject({ streetName: '9 Other Rd' });
    expect(actions.find((a) => a.action === 'setShippingAddress')?.address).toMatchObject({ streetName: '1 Main St' });
  });

  it('a saved address is sent as plain fields (no id) and works', async () => {
    const res = await call({ serviceAddress: { ...ADDRESS, id: 'addr-1', key: 'k', isService: true, isDefaultService: true } });
    expect(res.status).toBe(200);
    expect(JSON.stringify(world.actions)).not.toContain('addr-1');
  });

  it('not serviceable: the address is stored, answer 422 with the line ids and the state', async () => {
    world.unservableZips.add('10001');
    const res = await call({ serviceAddress: ADDRESS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_SERVICEABLE');
    expect(body.error.details).toEqual({ lineIds: ['L1'], postalCode: '10001' });
    expect(world.ct.shippingAddress).toBeDefined();
    expect(body.state.serviceAddress.postalCode).toBe('10001');
  });

  it('Address changes the total: shipping, tax and options are re-read from the cart after the address write', async () => {
    world.clearMethodOnAddress = true;
    world.ct.shippingInfo = { shippingMethod: { typeId: 'shipping-method', id: 'sm-standard' }, shippingMethodName: 'Standard shipping', price: { centAmount: 700, currencyCode: 'USD' } };
    const res = await call({ serviceAddress: ADDRESS });
    const { state } = await res.json();
    expect(state.delivery).toBeNull();
    expect(state.shipping).toBeNull();
    expect(state.tax).toEqual({ centAmount: 0, currencyCode: 'USD' });
    expect(state.cart.summary.total.centAmount).toBe(8499);
  });

  it('a cross-origin write is refused', async () => {
    const res = await POST(new Request('http://localhost/api/checkout/details', { method: 'POST', headers: { origin: 'https://evil.example', host: 'localhost' }, body: '{}' }));
    expect(res.status).toBe(403);
  });

  it('no cart: 400 NO_CART', async () => {
    world.ct.cartState = 'Ordered';
    const res = await call({ email: 'a@b.co' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('NO_CART');
  });
});
