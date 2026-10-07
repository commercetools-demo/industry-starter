import { ADDON_OFFERS, CABLE_OFFERS, HOME_TREE, OFFERS_BY_CATEGORY, PHONE_OFFERS } from '@/components/home/__fixtures__/home';
import { HOME_CONFIG } from '@/lib/config/home';
import { LISTED_CABLE_100, LISTED_CABLE_GIG, LISTED_PHONE_ESSENTIAL, usd } from '@/lib/listing/__fixtures__/catalog';
import type { Offer, PlanFacts } from '@/lib/types';
import { categoryTiles, fromPrice, heroFacts, listableOffers, popularAddons, promoPhone, resolveBanner } from './derive';

const withSpeed = (offer: Offer, downstreamMbps: number): Offer => ({ ...offer, facts: { ...(offer.facts as PlanFacts), downstreamMbps } });

describe('home derivations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('from-price is the lowest master price, excluding the online-only duplicate and unpriced offers', () => {
    const unpriced: Offer = { ...LISTED_PHONE_ESSENTIAL, key: 'x', anchors: ['x'], headline: { term: null, termMonths: null } };
    // the online-only offer is cheaper but is the restricted duplicate of Unlimited
    const cheapOnlineOnly: Offer = { ...PHONE_OFFERS[3]!, headline: { ...PHONE_OFFERS[3]!.headline, recurring: usd(100) } };
    expect(fromPrice([...PHONE_OFFERS.slice(0, 3), cheapOnlineOnly, unpriced])).toEqual(usd(2500));
    expect(fromPrice([unpriced])).toBeNull();
    expect(fromPrice([])).toBeNull();
  });

  it('listable offers hide the existing-customer cable offer from a first-time visitor', () => {
    expect(listableOffers(CABLE_OFFERS).map((offer) => offer.key)).not.toContain('malva-offer-cable-existing-customer');
  });

  it('1000 Mbps is shown in Gbps and 500 Mbps in Mbps', () => {
    expect(heroFacts([LISTED_CABLE_GIG]).speed).toEqual({ value: 1, unit: 'gbps' });
    expect(heroFacts([withSpeed(LISTED_CABLE_100, 500)]).speed).toEqual({ value: 500, unit: 'mbps' });
    expect(heroFacts([withSpeed(LISTED_CABLE_100, 1500)]).speed).toEqual({ value: 1.5, unit: 'gbps' });
  });

  it('hero facts: the cheapest cable offer sets price and the 24 months lock', () => {
    expect(heroFacts(CABLE_OFFERS)).toEqual({ speed: { value: 1, unit: 'gbps' }, months: 24, price: usd(3999) });
    expect(heroFacts([])).toEqual({ speed: null, months: 0, price: null });
  });

  it('promo phone price is the lowest listable phone plan', () => {
    expect(promoPhone(PHONE_OFFERS)).toEqual({ price: usd(2500) });
  });

  it('a missing popular add-on is skipped with one warning and the band is capped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const keys = ['malva-offer-spotify', 'malva-offer-missing', 'malva-offer-appletv', 'malva-offer-applemusic', 'malva-offer-netflix'];
    const result = popularAddons(ADDON_OFFERS, keys, 3);
    expect(result.map((addon) => addon.key)).toEqual(['malva-offer-spotify', 'malva-offer-appletv', 'malva-offer-applemusic']);
    expect(result[0]).toMatchObject({ name: 'Spotify', initial: 'S', price: usd(1000) });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[home] popular add-on not found', { key: 'malva-offer-missing' });
  });

  it('category tiles follow the tree order, hide devices and give add-ons no from price', () => {
    const tiles = categoryTiles(HOME_TREE, OFFERS_BY_CATEGORY, HOME_CONFIG.hiddenCategoryKeys);
    expect(tiles.map((tile) => tile.key)).toEqual(['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet', 'malva-cat-add-ons']);
    expect(tiles.map((tile) => tile.fromPrice)).toEqual([usd(2500), usd(4500), usd(3999), null]);
    expect(tiles[3]?.blurbKey).toBe('addons');
  });

  it('resolveBanner returns the category, or null with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveBanner(HOME_TREE, 'malva-cat-add-ons')?.category.key).toBe('malva-cat-add-ons');
    expect(warn).not.toHaveBeenCalled();
    expect(resolveBanner(HOME_TREE, 'malva-cat-nope')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[home] banner target does not resolve', { categoryKey: 'malva-cat-nope' });
  });
});
