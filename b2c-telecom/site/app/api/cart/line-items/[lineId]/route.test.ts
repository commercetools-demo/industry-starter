// @vitest-environment node
import { jsonRequest, resetRouteState, routeState } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, world } from '@/test/fixtures/bundleWorld';
import { POST as addLine } from '../route';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { DELETE, PATCH } from './route';

const add = (body: unknown) => addLine(jsonRequest('/api/cart/line-items', 'POST', body));
const patch = (lineId: string, body: unknown) => PATCH(jsonRequest(`/api/cart/line-items/${lineId}`, 'PATCH', body), { params: Promise.resolve({ lineId }) });
const del = (lineId: string, query = '') => DELETE(jsonRequest(`/api/cart/line-items/${lineId}${query}`, 'DELETE'), { params: Promise.resolve({ lineId }) });
const phone = { offerKey: 'malva-offer-phone-unlimited', sku: 'MLV-PHN-UNL-M2M' };
const cable = { offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M' };

beforeEach(() => {
  resetWorld();
  resetRouteState();
  routeState.session = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/cart/line-items/[lineId]', () => {
  it('Quantity changed: returns the full cart with the engine line total and summary, nothing computed client-side', async () => {
    await add(phone);
    const lineId = world.handle?.cart.lineItems[0]?.id as string;
    const res = await patch(lineId, { quantity: 3 });
    expect(res.status).toBe(200);
    const { cart } = await res.json();
    // 3 x 5500 comes from the (fake) server cart, which is what the route returns
    expect(cart.lines[0]).toMatchObject({ id: lineId, quantity: 3, total: { centAmount: 16500 } });
    expect(cart.summary).toMatchObject({ plans: { centAmount: 16500 }, total: { centAmount: 16500 } });
    expect(cart.version).toBe(world.handle?.cart.version);
  });

  it('dependents follow the plan quantity on the server', async () => {
    await add(phone);
    const lineId = world.handle?.cart.lineItems[0]?.id as string;
    await add({ offerKey: 'malva-offer-device-protect', sku: 'MLV-ADD-DEVCARE-MTH', parentLineId: lineId });
    const { cart } = await (await patch(lineId, { quantity: 2 })).json();
    expect(cart.lines.map((line: { quantity: number }) => line.quantity)).toEqual([2, 2]);
  });

  it('quantity 6 is refused with 422 OFFER_BLOCKED kind limit and the cart is unchanged', async () => {
    await add(phone);
    const lineId = world.handle?.cart.lineItems[0]?.id as string;
    const version = world.handle?.cart.version;
    const res = await patch(lineId, { quantity: 6 });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'OFFER_BLOCKED', details: { kind: 'limit' } });
    expect(body.cart.lines[0].quantity).toBe(1);
    expect(world.handle?.cart.version).toBe(version);
  });

  it('400 for a missing quantity and 404 for an unknown line', async () => {
    await add(phone);
    expect((await patch('x', {})).status).toBe(400);
    const res = await patch('nope', { quantity: 2 });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('LINE_NOT_FOUND');
  });

  it("another visitor's line is not found: the cart comes from the session, never from the request", async () => {
    await add(phone);
    const lineId = world.handle?.cart.lineItems[0]?.id as string;
    routeState.session = { anonymousId: 'someone-else', cartId: 'cart-new' };
    const res = await patch(lineId, { quantity: 2 });
    expect(res.status).toBe(404);
    expect(world.handle?.cart.lineItems[0]?.quantity).toBe(1);
  });
});

describe('DELETE /api/cart/line-items/[lineId]', () => {
  it('a plan with dependents is 409 HAS_DEPENDENTS naming them, then ?cascade=true removes everything and the fee', async () => {
    await add(cable);
    const planId = world.handle?.cart.lineItems[0]?.id as string;
    await add({ offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH', parentLineId: planId });
    const refused = await del(planId);
    expect(refused.status).toBe(409);
    const body = await refused.json();
    expect(body.error).toMatchObject({ code: 'HAS_DEPENDENTS', details: { dependents: [{ name: 'MLV-ADD-APPLETV-MTH' }] } });
    expect(body.cart.itemCount).toBe(2);

    const ok = await del(planId, '?cascade=true');
    expect(ok.status).toBe(200);
    const { cart } = await ok.json();
    expect(cart.lines).toEqual([]);
    expect(cart.itemCount).toBe(0);
    expect(world.handle?.cart.customLineItems).toHaveLength(0);
  });

  it('removing an add-on needs no confirmation', async () => {
    await add(cable);
    const planId = world.handle?.cart.lineItems[0]?.id as string;
    await add({ offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH', parentLineId: planId });
    const addonId = world.handle?.cart.lineItems[1]?.id as string;
    expect((await del(addonId)).status).toBe(200);
    expect(world.handle?.cart.lineItems).toHaveLength(1);
  });

  it('404 when the line is not in the bundle', async () => {
    await add(phone);
    expect((await del('nope')).status).toBe(404);
  });
});
