// @vitest-environment node
import { jsonRequest, resetRouteState, routeState } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, world } from '@/test/fixtures/bundleWorld';
import { POST as addLine } from '../line-items/route';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { POST } from './route';

const post = (body: unknown) => POST(jsonRequest('/api/cart/address', 'POST', body));

beforeEach(() => {
  resetWorld();
  resetRouteState();
  routeState.session = {};
});

describe('POST /api/cart/address', () => {
  it('400 for a postal code that is not five digits, a wrong country or no body', async () => {
    for (const body of [{ postalCode: '1234' }, { postalCode: 'abcde' }, {}, { postalCode: '10001', country: 'DE' }, '{']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_BODY');
    }
  });

  it('without a cart it answers { cart: null } and still remembers the ZIP in the cookie K reads', async () => {
    const res = await post({ postalCode: '10001' });
    expect(res.status).toBe(200);
    expect((await res.json()).cart).toBeNull();
    expect(res.cookies.get('malva-postal-code')?.value).toBe('10001');
  });

  it('writes the postal code, the serviceability flags and the shipping address on the cart', async () => {
    await addLine(jsonRequest('/api/cart/line-items', 'POST', { offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M' }));
    const res = await post({ postalCode: '60601', country: 'US' });
    expect(res.status).toBe(200);
    const { cart } = await res.json();
    expect(cart.postalCode).toBe('60601');
    const cartJson = world.handle?.cart as unknown as { custom: { fields: Record<string, unknown> }; shippingAddress: unknown };
    expect(cartJson.custom.fields).toMatchObject({ postalCode: '60601', serviceableCable: true, serviceableWireless: false, serviceablePhone: true });
    expect(cartJson.shippingAddress).toEqual({ country: 'US', postalCode: '60601' });
    expect(res.cookies.get('malva-postal-code')?.value).toBe('60601');
  });

  it('Location changes mid session: a plan the new ZIP does not serve becomes a blocking issue with the reason', async () => {
    await addLine(jsonRequest('/api/cart/line-items', 'POST', { offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M' }));
    const { cart } = await (await post({ postalCode: '59001' })).json();
    expect(cart.canCheckout).toBe(false);
    expect(cart.issues[0]).toMatchObject({ offerKey: 'malva-offer-cable-500', resolution: 'remove', reasons: [{ code: 'NOT_SERVICEABLE', params: { postalCode: '59001' } }] });
    const served = await (await post({ postalCode: '10001' })).json();
    expect(served.cart.issues).toEqual([]);
  });
});
