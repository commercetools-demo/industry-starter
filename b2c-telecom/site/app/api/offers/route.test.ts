/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { BuyerContext, Offer, PriceScope } from '@/lib/types';

const getAllOffers = vi.fn<(market: unknown, scope?: PriceScope) => Promise<Offer[]>>();
const getBuyerContext = vi.fn<() => Promise<BuyerContext>>();
vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: (market: unknown, scope?: PriceScope) => getAllOffers(market, scope) }));
vi.mock('@/lib/ct/buyer-context', () => ({ getBuyerContext: () => getBuyerContext() }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));

import * as route from './route';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  existingUnspecified: true,
  groupKeys: [],
  channel: 'online',
  now: new Date('2026-10-12T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});
const get = (query = '') => route.GET(new Request(`http://localhost/api/offers${query}`));
const keys = async (res: Response): Promise<string[]> => ((await res.json()).offers as { key: string }[]).map((offer) => offer.key);

const employeeOnly: Offer = { ...fx.netflix, key: 'malva-offer-employee-only', audience: ['employee'] };
const existingOnly: Offer = { ...fx.cableExisting, existingCustomer: 'existing' };
const newOnly: Offer = { ...fx.cable100, key: 'malva-offer-new-only', existingCustomer: 'new' };
const regional: Offer = { ...fx.spotify, key: 'malva-offer-regional', eligibleRegions: ['TX'] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getAllOffers.mockResolvedValue([...fx.ALL_OFFERS, employeeOnly, newOnly, regional].map((offer) => (offer.key === existingOnly.key ? existingOnly : offer)));
  getBuyerContext.mockResolvedValue(buyer());
});

describe('GET /api/offers', () => {
  it('base packages: the cable plans the buyer may buy, each with price, kind, family, promotion flag and included offers', async () => {
    const res = await get('?kind=base-package&family=cable');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.offers.map((offer: { family: string }) => offer.family)).toEqual(Array(body.offers.length).fill('cable'));
    expect(body.offers[0]).toMatchObject({ kind: 'base-package', chargeKind: 'recurring', firstMonthFree: false, includedOffers: expect.any(Array) });
    expect(body.offers[0].price.recurring.currencyCode).toBe('USD');
    expect(body.offers.find((offer: { key: string }) => offer.key === 'malva-offer-cable-500').includedOffers).toContain('malva-offer-modem-docsis31');
  });

  it('eligibility is the shared resolution: an employee-only offer is absent for a consumer and present for a declared employee', async () => {
    expect(await keys(await get('?kind=addon'))).not.toContain('malva-offer-employee-only');
    expect(await keys(await get('?kind=addon&customerType=employee'))).toContain('malva-offer-employee-only');
  });

  it('existing customer filter: true shows existing-only offers and hides new-only ones; false the reverse', async () => {
    const yes = await keys(await get('?kind=base-package&existingCustomer=true'));
    expect(yes).toContain('malva-offer-cable-existing-customer');
    expect(yes).not.toContain('malva-offer-new-only');
    const no = await keys(await get('?kind=base-package&existingCustomer=false'));
    expect(no).toContain('malva-offer-new-only');
    expect(no).not.toContain('malva-offer-cable-existing-customer');
    // not specified is not the same as no: only unrestricted offers
    const unspecified = await keys(await get('?kind=base-package'));
    expect(unspecified).not.toContain('malva-offer-new-only');
    expect(unspecified).not.toContain('malva-offer-cable-existing-customer');
  });

  it('a signed-in customer is not changed by the query', async () => {
    getBuyerContext.mockResolvedValue(buyer({ signedIn: true, existingUnspecified: false }));
    const res = await get('?customerType=employee&existingCustomer=true');
    const body = await res.json();
    expect(body.buyer).toMatchObject({ customerType: 'consumer', existingCustomer: 'no', fromAccount: true });
    expect(body.offers.map((offer: { key: string }) => offer.key)).not.toContain('malva-offer-employee-only');
  });

  it('prices are the buyer\'s: the catalog is read with the scope of the effective buyer', async () => {
    await get('?customerType=small-business');
    expect(getAllOffers).toHaveBeenCalledWith(expect.anything(), { groupKeys: ['small-business'], channelKey: null });
    getAllOffers.mockClear();
    getBuyerContext.mockResolvedValue(buyer({ signedIn: true, channel: 'call-center', groupKeys: ['call-center'] }));
    await get();
    expect(getAllOffers).toHaveBeenCalledWith(expect.anything(), { groupKeys: ['call-center'], channelKey: 'call-center' });
  });

  it('location filter: an offer sold in other states is dropped, and the response says whether the ZIP was in the table', async () => {
    const wa = await (await get('?kind=addon&postalCode=98101')).json();
    expect(wa.offers.map((offer: { key: string }) => offer.key)).not.toContain('malva-offer-regional');
    expect(wa.buyer.location).toMatchObject({ postalCode: '98101', state: 'WA', source: 'default' });
    const tx = await (await get('?kind=addon&postalCode=73301')).json();
    expect(tx.offers.map((offer: { key: string }) => offer.key)).toContain('malva-offer-regional');
    expect(tx.buyer.location).toMatchObject({ state: 'TX', source: 'table' });
  });

  it('an offer limited to regions is shown with "needs location" when no ZIP is known', async () => {
    const body = await (await get('?kind=addon')).json();
    expect(body.offers.find((offer: { key: string }) => offer.key === 'malva-offer-regional')).toMatchObject({ needsLocation: true });
  });

  it('invalid filter values are 400 INVALID_FILTER naming the field; none is silently dropped', async () => {
    for (const [query, field] of [['?kind=unicorn', 'kind'], ['?existingCustomer=maybe', 'existingCustomer'], ['?family=boat', 'family'], ['?customerType=vip', 'customerType'], ['?postalCode=abc', 'postalCode'], ['?limit=0', 'limit'], ['?limit=x', 'limit'], ['?offset=-1', 'offset']] as const) {
      const res = await get(query);
      expect(res.status, query).toBe(400);
      expect((await res.json()).error).toMatchObject({ code: 'INVALID_FILTER', details: { field } });
    }
  });

  it('paging: total, limit, offset and count, and each offer appears exactly once across pages', async () => {
    const all = await (await get('?limit=100')).json();
    const seen: string[] = [];
    for (let offset = 0; offset < all.total; offset += 5) {
      const page = await (await get(`?limit=5&offset=${offset}`)).json();
      expect(page).toMatchObject({ total: all.total, limit: 5, offset });
      expect(page.count).toBe(page.offers.length);
      seen.push(...page.offers.map((offer: { key: string }) => offer.key));
    }
    expect(seen).toEqual(all.offers.map((offer: { key: string }) => offer.key));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('upstream failure: 502 UPSTREAM_UNAVAILABLE with a generic message, no commercetools text', async () => {
    getAllOffers.mockRejectedValue(new Error('ct: invalid_token secret-detail'));
    const res = await get();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('secret-detail');
  });
});
