/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { BuyerContext, Offer } from '@/lib/types';

const getAllOffers = vi.fn<() => Promise<Offer[]>>();
const getBuyerContext = vi.fn<() => Promise<BuyerContext>>();
vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: () => getAllOffers() }));
vi.mock('@/lib/ct/buyer-context', () => ({ getBuyerContext: () => getBuyerContext() }));
const market = vi.hoisted(() => ({ value: { locale: 'en-US', currency: 'USD', country: 'US' } }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => market.value }));

import * as route from './route';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  existingUnspecified: false,
  groupKeys: [],
  channel: 'online',
  now: new Date('2026-10-12T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});
const get = (key: string) => route.GET(new Request(`http://localhost/api/offers/${key}`), { params: Promise.resolve({ key }) });
const keysOf = (items: { offer: { key: string } }[]) => items.map((item) => item.offer.key);

const needsApple: Offer = { ...fx.spotify, key: 'malva-offer-music', name: 'Music', requiresOffers: ['malva-offer-appletv'] };
const employeeOnly: Offer = { ...fx.cable100, key: 'malva-offer-employee-cable', audience: ['employee'] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  market.value = { locale: 'en-US', currency: 'USD', country: 'US' };
  getAllOffers.mockResolvedValue([...fx.ALL_OFFERS, needsApple, employeeOnly]);
  getBuyerContext.mockResolvedValue(buyer());
});

describe('GET /api/offers/[key]', () => {
  it('Cable 500: the modem is included, add-ons carry a verdict, equipment shows the unavailable ones with their reason', async () => {
    const res = await get('malva-offer-cable-500');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.offer).toMatchObject({ key: 'malva-offer-cable-500', kind: 'base-package', family: 'cable' });
    expect(keysOf(body.included)).toContain('malva-offer-modem-docsis31');
    expect(body.included[0].verdict.status).toBe('included');
    expect(keysOf(body.compatibleAddons)).toContain('malva-offer-appletv');
    expect(keysOf(body.compatibleAddons)).not.toContain('malva-offer-device-protect'); // phone-only: not offered at all
    const router = body.compatibleEquipment.find((item: { offer: { key: string } }) => item.offer.key === 'malva-offer-router-ax3000');
    expect(router.verdict).toMatchObject({ status: 'allowed' });
    const gateway = body.compatibleEquipment.find((item: { offer: { key: string } }) => item.offer.key === 'malva-offer-5g-gateway');
    expect(gateway.verdict.status).toBe('unavailable');
    expect(gateway.verdict.reasons[0]).toMatchObject({ code: 'TECHNOLOGY_MISMATCH', message: expect.stringContaining("Doesn't work") });
  });

  it('a fast plan marks an equipment item that cannot keep up as unavailable with the speed reason in the buyer\'s language', async () => {
    const body = await (await get('malva-offer-cable-gig')).json();
    const router = body.compatibleEquipment.find((item: { offer: { key: string } }) => item.offer.key === 'malva-offer-router-ac1200');
    expect(router.verdict.status).toBe('unavailable');
    expect(router.verdict.reasons[0]).toMatchObject({ code: 'SPEED_TOO_LOW', message: 'Supports up to 300 Mbps; Cable Gig delivers 1000 Mbps.' });
    market.value = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
    const german = await (await get('malva-offer-cable-gig')).json();
    expect(german.compatibleEquipment.find((item: { offer: { key: string } }) => item.offer.key === 'malva-offer-router-ac1200').verdict.reasons[0].message).toContain('Mbit/s');
  });

  it('an add-on that requires another offer lists what to add together', async () => {
    const body = await (await get('malva-offer-cable-500')).json();
    const music = body.compatibleAddons.find((item: { offer: { key: string } }) => item.offer.key === 'malva-offer-music');
    expect(music.verdict).toMatchObject({ status: 'allowed', requires: [{ offerKey: 'malva-offer-appletv', name: 'Apple TV+' }] });
  });

  it('an offer the buyer is not eligible for is 404 OFFER_NOT_FOUND, the same as an unknown key', async () => {
    const hidden = await get('malva-offer-employee-cable');
    const unknown = await get('malva-offer-nothing');
    expect(hidden.status).toBe(404);
    expect((await hidden.json()).error).toEqual((await unknown.json()).error);
    expect((await get('not-a-key')).status).toBe(404);
    getBuyerContext.mockResolvedValue(buyer({ customerType: 'employee' }));
    expect((await get('malva-offer-employee-cable')).status).toBe(200);
  });

  it('an add-on has no groups of its own', async () => {
    const body = await (await get('malva-offer-appletv')).json();
    expect(body).toMatchObject({ offer: { key: 'malva-offer-appletv' }, included: [], compatibleAddons: [], compatibleEquipment: [] });
  });

  it('upstream failure is 502 UPSTREAM_UNAVAILABLE', async () => {
    getAllOffers.mockRejectedValue(new Error('boom'));
    const res = await get('malva-offer-cable-500');
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
