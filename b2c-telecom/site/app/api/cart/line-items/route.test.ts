// @vitest-environment node
import { cable500, phoneEssential } from '@/lib/cart/__fixtures__/offers';
import { defaultBuyer, jsonRequest, resetRouteState, routeState, sessionMock } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, seedCart, world } from '@/test/fixtures/bundleWorld';
import type { Offer } from '@/lib/types';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { POST } from './route';

const post = (body: unknown) => POST(jsonRequest('/api/cart/line-items', 'POST', body));
const cable = { offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M' };
const withFacts = (offer: Offer, patch: object): Offer => ({ ...offer, facts: { ...(offer.facts as object), ...patch } as never });

beforeEach(() => {
  resetWorld();
  resetRouteState();
  routeState.session = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  void sessionMock;
});

describe('POST /api/cart/line-items', () => {
  it('an anonymous add creates the cart, writes the session and answers the full mapped cart', async () => {
    const res = await post(cable);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { cart } = await res.json();
    expect(world.created).toBe(1);
    expect(routeState.patches[0]).toMatchObject({ cartId: 'cart-new' });
    expect(routeState.patches[0]?.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(cart.lines.map((line: { kind: string }) => line.kind)).toEqual(['plan', 'fee']);
    expect(cart.lines[0]).toMatchObject({ offerKey: 'malva-offer-cable-500', recurrence: { priceSelectionMode: 'Fixed' }, label: { id: 'MLV-CBL-500-24M' } });
    expect(cart.summary).toMatchObject({ monthly: { centAmount: 5999 }, oneTime: { centAmount: 2500 }, total: { centAmount: 8499 } });
    expect(cart.itemCount).toBe(1);
  });

  it('400 for a body that is not JSON, lacks the keys or has a bad quantity', async () => {
    for (const body of ['{', {}, { offerKey: 'x' }, { ...cable, quantity: 0 }, { ...cable, quantity: 1.5 }, { ...cable, parentLineId: 3 }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_BODY');
    }
    expect(world.created).toBe(0);
  });

  it('404 for an unknown offer and an unknown sku', async () => {
    expect(((await (await post({ offerKey: 'malva-offer-nope', sku: 'X' })).json()) as { error: { code: string } }).error.code).toBe('UNKNOWN_OFFER');
    const res = await post({ offerKey: cable.offerKey, sku: 'NOPE' });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('UNKNOWN_SKU');
  });

  it('a blocked add returns the status table, the reasons and the unchanged cart', async () => {
    seedCart();
    routeState.session = { anonymousId: 'anon-1', cartId: 'cart-1' };
    await post(cable); // plan in the bundle
    const before = world.handle?.cart.version;
    const incompatible = await post({ offerKey: 'malva-offer-device-protect', sku: 'MLV-ADD-DEVCARE-MTH' });
    expect(incompatible.status).toBe(409);
    const body = await incompatible.json();
    expect(body.error).toMatchObject({ code: 'OFFER_BLOCKED', details: { kind: 'incompatible', offerKey: 'malva-offer-device-protect' } });
    expect(body.error.details.reasons[0]).toMatchObject({ code: 'FAMILY_MISMATCH', messageKey: 'offers.reason.FAMILY_MISMATCH' });
    expect(body.cart.itemCount).toBe(1);
    expect(world.handle?.cart.version).toBe(before);

    const limit = await post({ ...cable, quantity: 1 });
    expect(limit.status).toBe(422);
    expect((await limit.json()).error.details).toMatchObject({ kind: 'limit', reasons: [{ code: 'QUANTITY_FIXED' }] });
  });

  it('an ineligible offer is 403 and nothing is written', async () => {
    routeState.offers = routeState.offers.map((offer) => (offer.key === 'malva-offer-cable-500' ? { ...offer, audience: ['employee'] } : offer));
    const res = await post(cable);
    expect(res.status).toBe(403);
    expect((await res.json()).error.details).toMatchObject({ kind: 'ineligible' });
    expect(world.created).toBe(0);
  });

  it('a conflict offers a replace; the replace flow re-guards after the removal and adds the new plan without leftovers', async () => {
    await post(cable);
    const planLine = world.handle?.cart.lineItems[0]?.id as string;
    const blocked = await post({ offerKey: 'malva-offer-wireless-5g', sku: 'MLV-AIR-5G-12M' });
    expect(blocked.status).toBe(409);
    const details = (await blocked.json()).error.details;
    expect(details).toMatchObject({ kind: 'conflict', replace: { removeLineId: planLine, removeOfferKey: 'malva-offer-cable-500' } });

    const replaced = await post({ offerKey: 'malva-offer-wireless-5g', sku: 'MLV-AIR-5G-12M', replaceLineId: planLine });
    expect(replaced.status).toBe(200);
    const { cart } = await replaced.json();
    expect(cart.lines.map((line: { offerKey: string }) => line.offerKey)).toEqual(['malva-offer-wireless-5g']);
    expect(world.handle?.cart.customLineItems).toHaveLength(0);
  });

  it('a replace of a line that is not in the bundle is 404', async () => {
    await post(cable);
    const res = await post({ offerKey: 'malva-offer-wireless-5g', sku: 'MLV-AIR-5G-12M', replaceLineId: 'nope' });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('LINE_NOT_FOUND');
  });

  it('stock: equipment without stock is 409 INSUFFICIENT_STOCK with `available`; services never query inventory', async () => {
    await post({ offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M' });
    expect(world.inventoryCalls).toBe(0);
    await post(cable);
    const planLine = world.handle?.cart.lineItems.find((line) => line.variant.sku === 'MLV-CBL-500-24M')?.id;
    world.inventory['MLV-EQP-AX3000-BUY'] = 0;
    const none = await post({ offerKey: 'malva-offer-router-ax3000', sku: 'MLV-EQP-AX3000-BUY', parentLineId: planLine });
    expect(none.status).toBe(409);
    expect((await none.json()).error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 0 } });
  });

  it('Required data missing: the plan is not added and the gap is logged for the catalog owner', async () => {
    routeState.offers = routeState.offers.map((offer) => (offer.key === cable500.key ? withFacts(offer, { typicalLatencyMs: undefined }) : offer));
    const res = await post(cable);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'LABEL_DATA_MISSING', details: { missing: ['typical-latency-ms'] } });
    expect(world.created).toBe(0);
    expect(console.error).toHaveBeenCalledWith('[catalog-gap] offer=malva-offer-cable-500 sku=MLV-CBL-500-24M missing=typical-latency-ms');
  });

  it('a plan whose schedule cannot be built is 422 SCHEDULE_NOT_PRICEABLE and nothing is written', async () => {
    const res = await post({ offerKey: 'malva-offer-cable-gig', sku: 'MLV-CBL-GIG-24M' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('SCHEDULE_NOT_PRICEABLE');
    expect(world.created).toBe(0);
  });

  it('a phone plan added again becomes two lines of service, the sixth is refused', async () => {
    const phone = { offerKey: phoneEssential.key, sku: 'MLV-PHN-ESS-M2M' };
    for (let n = 0; n < 5; n += 1) expect((await post(phone)).status).toBe(200);
    expect(world.handle?.cart.lineItems[0]?.quantity).toBe(5);
    const sixth = await post(phone);
    expect(sixth.status).toBe(422);
    expect((await sixth.json()).error.details.reasons[0].code).toBe('QUANTITY_OUT_OF_RANGE');
  });

  it('a buyer from another market sees no cart of the other currency: the add creates a new cart', async () => {
    seedCart({ totalPrice: { type: 'centPrecision', centAmount: 0, currencyCode: 'EUR', fractionDigits: 2 }, country: 'DE' });
    routeState.session = { anonymousId: 'anon-1', cartId: 'cart-1' };
    await post({ offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M' });
    expect(world.created).toBe(1);
    void defaultBuyer;
  });
});
