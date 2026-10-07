// @vitest-environment node
import { resetRouteState, routeState } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, seedCart } from '@/test/fixtures/bundleWorld';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { GET } from './route';

beforeEach(() => {
  resetWorld();
  resetRouteState();
});

describe('GET /api/cart', () => {
  it('answers { cart: null } for a visitor without a cart and writes nothing', async () => {
    routeState.session = {};
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cart: null });
    expect(routeState.patches).toEqual([]);
  });

  it('a session cart id that no longer exists is cleared from the session', async () => {
    routeState.session = { anonymousId: 'anon-1', cartId: 'gone' };
    expect(await (await GET()).json()).toEqual({ cart: null });
    expect(routeState.patches).toEqual([{ cartId: undefined }]);
  });

  it('a cart that is not Active (ordered) is cleared from the session', async () => {
    seedCart({ cartState: 'Ordered' });
    expect(await (await GET()).json()).toEqual({ cart: null });
    expect(routeState.patches).toEqual([{ cartId: undefined }]);
  });

  it("another visitor's cart is never returned", async () => {
    seedCart({ anonymousId: 'someone-else' });
    expect(await (await GET()).json()).toEqual({ cart: null });
  });

  it('returns the mapped cart and leaves the session alone when it already has the id', async () => {
    seedCart();
    const body = await (await GET()).json();
    expect(body.cart).toMatchObject({ id: 'cart-1', itemCount: 0, canCheckout: false, checkoutBlockedBy: ['EMPTY'] });
    expect(routeState.patches).toEqual([]);
  });
});
