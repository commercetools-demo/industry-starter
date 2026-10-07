// @vitest-environment node
import { NOVA_5G_OFFER, NOVA_PRO_OFFER } from '@/lib/devices/__fixtures__/offers';
import { jsonRequest, resetRouteState, routeState, sessionMock } from '@/test/fixtures/bundleMocks';
import { deviceWorld, makeDeviceApiRoot, resetDeviceWorld, seedDeviceCart } from '@/test/fixtures/deviceWorld';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeDeviceApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { POST as addGeneric } from '../line-items/route';
import { POST } from './route';

const PRO_256 = 'MLV-DEV-NOVAPRO-BLK-256';
const PRO = 'malva-offer-phone-nova-pro';
const post = (body: unknown) => POST(jsonRequest('/api/cart/devices', 'POST', body));
const add = (sku: string, mode: string, termMonths?: number, quantity = 1, offerKey = PRO) => post({ offerKey, sku, quantity, mode, ...(termMonths === undefined ? {} : { termMonths }) });
type Line = { sku: string; acquisition?: unknown; kind: string; quantity: number; total: { centAmount: number } };

beforeEach(() => {
  resetDeviceWorld();
  resetRouteState();
  routeState.offers = [NOVA_5G_OFFER, NOVA_PRO_OFFER];
  routeState.session = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  void sessionMock;
});

describe('POST /api/cart/devices', () => {
  it('Same device three modes: each mode is priced from its own policy and is its own line', async () => {
    const outright = await (await add(PRO_256, 'outright')).json();
    expect(outright.cart.lines).toHaveLength(1);
    expect(outright.cart.lines[0]).toMatchObject({ kind: 'device', total: { centAmount: 100800 } });
    const line = deviceWorld.cart?.lineItems[0];
    expect(line?.recurrenceInfo).toBeUndefined();
    expect(line?.price.recurrencePolicy).toBeUndefined();

    await add(PRO_256, 'installments', 24);
    const lease = await (await add(PRO_256, 'lease', 24)).json();
    const lines = lease.cart.lines as Line[];
    expect(lines).toHaveLength(3);
    expect(lines.map((entry) => entry.total.centAmount)).toEqual([100800, 4200, 3300]);
    expect(deviceWorld.cart?.lineItems.map((entry) => entry.custom.fields.acquisitionMode)).toEqual(['outright', 'installments', 'lease']);
    expect(deviceWorld.cart?.lineItems[1]?.recurrenceInfo).toMatchObject({ priceSelectionMode: 'Fixed' });
    expect(deviceWorld.cart?.lineItems[1]?.price.recurrencePolicy?.id).toBe('pol-24');
    expect(deviceWorld.cart?.lineItems[2]?.price.recurrencePolicy?.id).toBe('pol-lease');
  });

  it('Mode unavailable for this device: lease on Nova 5G is refused with 409 naming outright and installments', async () => {
    const res = await add('MLV-DEV-NOVA5G-BLK-128', 'lease', 24, 1, 'malva-offer-phone-nova-5g');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('MODE_UNAVAILABLE');
    expect(body.error.details.available).toEqual(['outright', 'installments']);
    expect(body.error.message).toBe('Lease is not available for Nova 5G. Available: pay in full, installments.');
    expect(body.cart).toBeNull();
    expect(deviceWorld.created).toBe(0);
    expect(deviceWorld.updates).toEqual([]);
  });

  it('TERM_UNAVAILABLE names the terms that have a price (Nova 5G 256 Silver has no 36 months)', async () => {
    const res = await add('MLV-DEV-NOVA5G-SLV-256', 'installments', 36, 1, 'malva-offer-phone-nova-5g');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'TERM_UNAVAILABLE', details: { availableTerms: [12, 24] } });
    expect(deviceWorld.created).toBe(0);
    expect((await add('MLV-DEV-NOVA5G-SLV-256', 'installments', 24, 1, 'malva-offer-phone-nova-5g')).status).toBe(200);
  });

  it('a lease term other than 24 is TERM_UNAVAILABLE', async () => {
    const res = await add(PRO_256, 'lease', 12);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'TERM_UNAVAILABLE', details: { availableTerms: [24] } });
  });

  it('PRICE_NOT_FOR_TERM: a price that did not come from the policy is rolled back and answered 422', async () => {
    deviceWorld.lostPrices.add(`${PRO_256}|malva-device-installment-24`);
    const res = await add(PRO_256, 'installments', 24);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'PRICE_NOT_FOR_TERM', details: { check: 'price-has-no-policy' } });
    // the cart was created for this add only: the line is taken out again and the empty cart is deleted (the error answer cannot remember it)
    expect(body.cart).toBeNull();
    expect(deviceWorld.cart).toBeUndefined();
    expect(deviceWorld.updates.at(-1)?.actions).toEqual([{ action: 'removeLineItem', lineItemId: 'line-1' }]);
  });

  it('a second identical add merges into one line, but never beyond 3', async () => {
    const first = await (await add(PRO_256, 'installments', 24, 2)).json();
    expect(first.cart.lines).toHaveLength(1);
    const second = await add(PRO_256, 'installments', 24, 1);
    expect(second.status).toBe(200);
    expect(deviceWorld.cart?.lineItems).toHaveLength(1);
    expect(deviceWorld.cart?.lineItems[0]?.quantity).toBe(3);
    const third = await add(PRO_256, 'installments', 24, 1);
    expect(third.status).toBe(422);
    expect((await third.json()).error.details).toMatchObject({ kind: 'limit' });
  });

  it('refuses a quantity of 4 and a body without the keys it needs (400 INVALID_INPUT), and non-JSON (INVALID_BODY)', async () => {
    for (const body of [
      { offerKey: PRO, sku: PRO_256, quantity: 4, mode: 'outright' },
      { offerKey: PRO, sku: PRO_256, quantity: 0, mode: 'outright' },
      { offerKey: PRO, sku: PRO_256, quantity: 1.5, mode: 'outright' },
      { offerKey: PRO, quantity: 1, mode: 'outright' },
      { offerKey: PRO, sku: PRO_256, quantity: 1, mode: 'rent' },
      { offerKey: PRO, sku: PRO_256, quantity: 1, mode: 'installments' },
      { offerKey: PRO, sku: PRO_256, quantity: 1, mode: 'installments', termMonths: '24' },
    ]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_INPUT');
    }
    const bad = await post('{');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('INVALID_BODY');
    expect(deviceWorld.created).toBe(0);
  });

  it('404 for an unknown offer or sku', async () => {
    expect((await (await add(PRO_256, 'outright', undefined, 1, 'malva-offer-nope')).json()).error.code).toBe('OFFER_NOT_FOUND');
    const unknownSku = await add('NOPE', 'outright');
    expect(unknownSku.status).toBe(404);
    expect((await unknownSku.json()).error.code).toBe('UNKNOWN_SKU');
  });

  it('refuses a handset that is out of stock (the platform inventory mode is None, so the app checks)', async () => {
    deviceWorld.inventory[PRO_256] = 0;
    const res = await add(PRO_256, 'outright');
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 0 } });
    deviceWorld.inventory[PRO_256] = 2;
    expect((await add(PRO_256, 'outright', undefined, 3)).status).toBe(409);
  });

  it('an ineligible handset is 403 and nothing is written', async () => {
    routeState.offers = [{ ...NOVA_PRO_OFFER, audience: ['employee'] }, NOVA_5G_OFFER];
    const res = await add(PRO_256, 'outright');
    expect(res.status).toBe(403);
    expect(deviceWorld.created).toBe(0);
  });

  it('does not touch a cart the session does not own', async () => {
    seedDeviceCart({ anonymousId: 'someone-else' });
    routeState.session = { anonymousId: 'anon-2', cartId: 'cart-1' };
    const res = await add(PRO_256, 'outright');
    expect(res.status).toBe(200);
    expect(deviceWorld.created).toBe(1);
    expect(routeState.patches[0]).toMatchObject({ cartId: 'cart-new' });
  });

  it('the generic add route refuses a device (it must carry a mode and a term)', async () => {
    const res = await addGeneric(jsonRequest('/api/cart/line-items', 'POST', { offerKey: PRO, sku: PRO_256 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('USE_DEVICE_ROUTE');
  });
});
