// @vitest-environment node
import { CART_OFFERS } from '@/lib/cart/__fixtures__/offers';
import { resetRouteState, routeState } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, seedCart } from '@/test/fixtures/bundleWorld';
import { ctCart } from '@/test/fixtures/ctCart';

const probe = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));
vi.mock('@/lib/ct/cart', async (original) => ({
  ...(await original<typeof import('@/lib/ct/cart')>()),
  createProbeCart: (draft: unknown) => probe.create(draft),
  deleteCart: (cart: unknown) => probe.remove(cart),
}));

import { GET } from './route';

const categories: Record<string, string[]> = {
  'malva-offer-cable-500': ['malva-cat-cable-internet'],
  'malva-offer-phone-essential': ['malva-cat-phone-plans'],
};

beforeEach(() => {
  resetWorld();
  resetRouteState();
  probe.create.mockReset();
  probe.remove.mockReset().mockResolvedValue(undefined);
  routeState.offers = CART_OFFERS.map((offer) => ({ ...offer, categoryKeys: categories[offer.key] ?? offer.categoryKeys }));
});

describe('GET /api/cart/prompts', () => {
  it('returns { prompts: [] } for a visitor without a cart and for an empty cart, and prices nothing', async () => {
    routeState.session = {};
    expect(await (await GET()).json()).toEqual({ prompts: [] });
    seedCart();
    expect(await (await GET()).json()).toEqual({ prompts: [] });
    expect(probe.create).not.toHaveBeenCalled();
  });

  it('quotes the saving of the pairing from a priced probe cart and deletes the probe', async () => {
    const handle = seedCart();
    handle.apply(handle.cart.version, [
      { action: 'addLineItem', sku: 'MLV-CBL-500-24M', quantity: 1, recurrenceInfo: { priceSelectionMode: 'Fixed' }, custom: { fields: { offerKey: 'malva-offer-cable-500' } } },
    ]);
    probe.create.mockResolvedValue(
      ctCart({
        lines: [
          { id: 'L1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed', discounts: ['cd-bundle'], discountCents: 500 },
          { id: 'P1', sku: 'MLV-PHN-ESS-M2M', offerKey: 'malva-offer-phone-essential', price: 2500, mode: 'Dynamic' },
        ],
      }),
    );
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { prompts } = await res.json();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ pairingKey: 'bundle-cable-phone', saving: { centAmount: 500, currencyCode: 'USD' }, params: { name: 'Essential', saving: '$5.00' } });
    expect(probe.remove).toHaveBeenCalledTimes(1);
  });
});
