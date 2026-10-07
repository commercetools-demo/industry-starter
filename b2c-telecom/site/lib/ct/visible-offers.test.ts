// @vitest-environment node
import * as fx from '@/lib/offers/__fixtures__/offers';
import { filterEligible } from '@/lib/offers/eligibility';
import { createCachedServiceability, createStubProvider } from '@/lib/offers/serviceability';
import type { BuyerContext, Market, Offer } from '@/lib/types';

const getBuyerContext = vi.fn<(market?: Market) => Promise<BuyerContext>>();
vi.mock('./buyer-context', () => ({ getBuyerContext: (market?: Market) => getBuyerContext(market) }));
const getAllOffers = vi.fn<(market: Market) => Promise<Offer[]>>();
const getOffersInCategory = vi.fn<(key: string, market: Market) => Promise<Offer[]>>();
vi.mock('./catalog', () => ({
  getAllOffers: (market: Market) => getAllOffers(market),
  getOffersInCategory: (key: string, market: Market) => getOffersInCategory(key, market),
}));

import { getVisibleOfferByKey, getVisibleOffers, getVisibleOffersInCategory } from './visible-offers';

const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const baseBuyer: BuyerContext = { customerType: 'consumer', isExistingCustomer: false, channel: 'online', now: new Date('2026-10-07T12:00:00Z'), held: [], signedIn: false };
const home = [fx.cable500, fx.wireless5g, fx.cableExisting, fx.phoneEssential];
const existingOnly: Offer = { ...fx.cableExisting, existingCustomer: 'existing' };

beforeEach(() => {
  vi.clearAllMocks();
  getBuyerContext.mockResolvedValue(baseBuyer);
  getAllOffers.mockResolvedValue([...home.filter((offer) => offer.key !== existingOnly.key), existingOnly]);
  getOffersInCategory.mockResolvedValue([fx.wireless5g, fx.cable500, existingOnly]);
});

describe('visible offers', () => {
  it('Catalog reflects the location: browse and search resolve through one filter', async () => {
    const location = await createCachedServiceability(createStubProvider('table'), 300).check('60601', 'US');
    getBuyerContext.mockResolvedValue({ ...baseBuyer, location });
    const all = await getVisibleOffers(US);
    const category = await getVisibleOffersInCategory('malva-cat-home-wireless', US);
    expect(all.offers.map((offer) => offer.key)).toEqual(['malva-offer-cable-500', 'malva-offer-phone-essential']);
    expect(category.offers.map((offer) => offer.key)).toEqual(['malva-offer-cable-500']);
    // P filters search hits with the same function and the same buyer
    expect(filterEligible([fx.wireless5g, fx.cable500, fx.phoneEssential], all.buyer).map((offer) => offer.key)).toEqual(['malva-offer-cable-500', 'malva-offer-phone-essential']);
    expect(all.availability).toEqual({ state: 'partially-served', technologies: ['cable', 'mobile'] });
  });

  it('removes ineligible offers, reports not-served for ZIP 99999 and no-location without a ZIP', async () => {
    expect((await getVisibleOffers(US)).availability.state).toBe('no-location');
    expect((await getVisibleOffers(US)).offers.map((offer) => offer.key)).not.toContain('malva-offer-cable-existing-customer');
    const location = await createCachedServiceability(createStubProvider('table'), 300).check('99999', 'US');
    getBuyerContext.mockResolvedValue({ ...baseBuyer, location });
    const unserved = await getVisibleOffers(US);
    expect(unserved.availability).toEqual({ state: 'not-served', technologies: [] });
    expect(unserved.offers).toEqual([]);
  });

  it('an existing customer sees the existing-customer offer', async () => {
    getBuyerContext.mockResolvedValue({ ...baseBuyer, isExistingCustomer: true, signedIn: true });
    expect((await getVisibleOffers(US)).offers.map((offer) => offer.key)).toContain('malva-offer-cable-existing-customer');
  });

  it('getVisibleOfferByKey returns null for an ineligible or unknown key and the offer otherwise', async () => {
    expect(await getVisibleOfferByKey('malva-offer-cable-existing-customer', US)).toBeNull();
    expect(await getVisibleOfferByKey('malva-offer-nope', US)).toBeNull();
    expect((await getVisibleOfferByKey('malva-offer-cable-500', US))?.key).toBe('malva-offer-cable-500');
    getBuyerContext.mockResolvedValue({ ...baseBuyer, isExistingCustomer: true });
    expect((await getVisibleOfferByKey('malva-offer-cable-existing-customer', US))?.key).toBe('malva-offer-cable-existing-customer');
  });

  it('passes the market to the buyer context', async () => {
    await getVisibleOffers(US);
    expect(getBuyerContext).toHaveBeenCalledWith(US);
  });
});
