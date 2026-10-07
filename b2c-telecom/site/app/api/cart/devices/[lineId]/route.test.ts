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

import { POST } from '../route';
import { PATCH } from './route';

const PRO_256 = 'MLV-DEV-NOVAPRO-BLK-256';
const add = (sku: string, mode: string, termMonths?: number, quantity = 1, offerKey = 'malva-offer-phone-nova-pro') =>
  POST(jsonRequest('/api/cart/devices', 'POST', { offerKey, sku, quantity, mode, ...(termMonths === undefined ? {} : { termMonths }) }));
const patch = (lineId: string, body: unknown) => PATCH(jsonRequest(`/api/cart/devices/${lineId}`, 'PATCH', body), { params: Promise.resolve({ lineId }) });
const fieldsOf = () => deviceWorld.cart?.lineItems.map((line) => line.custom.fields) ?? [];

beforeEach(async () => {
  resetDeviceWorld();
  resetRouteState();
  routeState.offers = [NOVA_5G_OFFER, NOVA_PRO_OFFER];
  routeState.session = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  void sessionMock;
});

describe('PATCH /api/cart/devices/[lineId]', () => {
  it('Mode changed before checkout: the line is removed and re-added in one update, repriced, with the new term', async () => {
    await add(PRO_256, 'installments', 24);
    const oldId = deviceWorld.cart?.lineItems[0]?.id ?? '';
    const versionBefore = deviceWorld.cart?.version ?? 0;
    const updatesBefore = deviceWorld.updates.length;

    const res = await patch(oldId, { mode: 'lease', termMonths: 24 });
    expect(res.status).toBe(200);
    const { cart } = await res.json();
    expect(deviceWorld.updates).toHaveLength(updatesBefore + 1);
    expect(deviceWorld.updates.at(-1)?.actions.map((action) => action.action)).toEqual(['removeLineItem', 'addLineItem']);
    expect(deviceWorld.cart?.version).toBe(versionBefore + 1);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].id).not.toBe(oldId);
    expect(cart.lines[0].total.centAmount).toBe(3300);
    expect(deviceWorld.cart?.lineItems[0]?.price.recurrencePolicy?.id).toBe('pol-lease');
    expect(fieldsOf()[0]).toMatchObject({ acquisitionMode: 'lease', acquisitionTermMonths: 24, acquisitionEndOfTerm: 'return' });

    // and back to pay in full: no recurrence, the one-time price, term 0
    const back = await patch(deviceWorld.cart?.lineItems[0]?.id ?? '', { mode: 'outright' });
    expect(back.status).toBe(200);
    expect(deviceWorld.cart?.lineItems[0]?.recurrenceInfo).toBeUndefined();
    expect(deviceWorld.cart?.lineItems[0]?.price.value.centAmount).toBe(100800);
    expect(fieldsOf()[0]).toMatchObject({ acquisitionMode: 'outright', acquisitionTermMonths: 0 });
  });

  it('keeps the quantity and the place of the line (addedAt travels with the new line)', async () => {
    await add(PRO_256, 'outright', undefined, 2);
    const line = deviceWorld.cart?.lineItems[0];
    if (line) line.addedAt = '2026-10-07T10:00:00.000Z';
    await patch(line?.id ?? '', { mode: 'installments', termMonths: 12 });
    expect(deviceWorld.cart?.lineItems[0]).toMatchObject({ quantity: 2, addedAt: '2026-10-07T10:00:00.000Z' });
    expect(deviceWorld.cart?.lineItems[0]?.price.value.centAmount).toBe(8400);
  });

  it('asking for the mode the line already has changes nothing', async () => {
    await add(PRO_256, 'installments', 24);
    const updates = deviceWorld.updates.length;
    const res = await patch(deviceWorld.cart?.lineItems[0]?.id ?? '', { mode: 'installments', termMonths: 24 });
    expect(res.status).toBe(200);
    expect(deviceWorld.updates).toHaveLength(updates);
  });

  it('Mode unavailable for this device: a lease for a Nova 5G line is refused with the available modes and the line is untouched', async () => {
    await add('MLV-DEV-NOVA5G-BLK-128', 'installments', 24, 1, 'malva-offer-phone-nova-5g');
    const updates = deviceWorld.updates.length;
    const res = await patch(deviceWorld.cart?.lineItems[0]?.id ?? '', { mode: 'lease', termMonths: 24 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'MODE_UNAVAILABLE', details: { available: ['outright', 'installments'] } });
    expect(body.cart.lines).toHaveLength(1);
    expect(deviceWorld.updates).toHaveLength(updates);
  });

  it('PRICE_NOT_FOR_TERM on a change puts the old mode back and answers 422', async () => {
    await add(PRO_256, 'installments', 24);
    deviceWorld.lostPrices.add(`${PRO_256}|malva-device-lease-24`);
    const res = await patch(deviceWorld.cart?.lineItems[0]?.id ?? '', { mode: 'lease', termMonths: 24 });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('PRICE_NOT_FOR_TERM');
    expect(deviceWorld.cart?.lineItems).toHaveLength(1);
    expect(fieldsOf()[0]).toMatchObject({ acquisitionMode: 'installments', acquisitionTermMonths: 24 });
    expect(deviceWorld.cart?.lineItems[0]?.price.value.centAmount).toBe(4200);
  });

  it('404 LINE_NOT_FOUND for a line that is not in the cart of this session', async () => {
    await add(PRO_256, 'outright');
    const res = await patch('line-999', { mode: 'installments', termMonths: 24 });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('LINE_NOT_FOUND');
  });

  it("another visitor's line is never found (ownership of the cart is re-checked, D-070)", async () => {
    seedDeviceCart({ anonymousId: 'someone-else' });
    await add(PRO_256, 'outright'); // the session has no cart yet: a new one is created for it
    const mine = deviceWorld.cart?.id;
    seedDeviceCart({ anonymousId: 'someone-else', id: 'cart-1' });
    routeState.session = { anonymousId: routeState.session.anonymousId ?? 'x', cartId: 'cart-1' };
    const res = await patch('line-1', { mode: 'installments', termMonths: 24 });
    expect(res.status).toBe(404);
    expect(mine).toBe('cart-new');
  });

  it('400 NOT_A_DEVICE_LINE for a line without an acquisition mode, and 400 for a bad body', async () => {
    seedDeviceCart();
    routeState.session = { anonymousId: 'anon-1', cartId: 'cart-1' };
    deviceWorld.cart?.lineItems.push({
      id: 'plain',
      name: { 'en-US': 'x' },
      variant: { id: 1, sku: PRO_256 },
      price: { value: { type: 'centPrecision', centAmount: 1, currencyCode: 'USD', fractionDigits: 2 } },
      quantity: 1,
      totalPrice: { type: 'centPrecision', centAmount: 1, currencyCode: 'USD', fractionDigits: 2 },
      discountedPricePerQuantity: [],
      custom: { fields: { offerKey: 'malva-offer-phone-nova-pro' } },
    });
    const res = await patch('plain', { mode: 'outright' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('NOT_A_DEVICE_LINE');
    for (const body of [{}, { mode: 'rent' }, { mode: 'lease' }, { mode: 'installments', termMonths: 0 }]) {
      const bad = await patch('plain', body);
      expect(bad.status, JSON.stringify(body)).toBe(400);
      expect((await bad.json()).error.code).toBe('INVALID_INPUT');
    }
  });
});
