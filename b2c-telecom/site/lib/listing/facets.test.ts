import type { Offer } from '@/lib/types';
import {
  LISTED_APPLETV,
  LISTED_CABLE_100,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_PHONE_ESSENTIAL,
  LISTED_PHONE_UNLIMITED,
  LISTED_ROUTER_AC1200,
  LISTED_SPOTIFY,
  LISTED_WIRELESS_5G,
  LISTED_WIRELESS_LITE,
} from './__fixtures__/catalog';
import { applyFacets, CHIP_GROUP, chipGroupVisible, facetCounts, planChipId, type FacetGroup } from './facets';

const withMbps = (offer: Offer, mbps: number): Offer => ({ ...offer, facts: { ...(offer.facts as object), downstreamMbps: mbps } as Offer['facts'] });

describe('chip bands (D-017)', () => {
  it('500 Mbps belongs to "Up to 500 Mbps" and 1000 Mbps to "1 Gbps"', () => {
    expect(planChipId(withMbps(LISTED_CABLE_100, 500))).toBe('up-to-500');
    expect(planChipId(withMbps(LISTED_CABLE_100, 501))).toBe('1-gbps');
    expect(planChipId(LISTED_CABLE_GIG)).toBe('1-gbps');
    expect(planChipId(LISTED_CABLE_500)).toBe('up-to-500');
  });

  it('-1 data is Unlimited, anything else Data-capped', () => {
    expect(planChipId(LISTED_PHONE_UNLIMITED)).toBe('unlimited');
    expect(planChipId(LISTED_PHONE_ESSENTIAL)).toBe('data-capped');
  });

  it('wireless: 5g and 4g', () => {
    expect(planChipId(LISTED_WIRELESS_5G)).toBe('5g');
    expect(planChipId(LISTED_WIRELESS_LITE)).toBe('lte');
  });

  it('only plans have a chip', () => {
    expect(planChipId(LISTED_SPOTIFY)).toBeNull();
  });

  it('the add-on tag chips match exactly; equipment has no tag', () => {
    expect(applyFacets([LISTED_SPOTIFY, LISTED_APPLETV, LISTED_ROUTER_AC1200], [CHIP_GROUP], { filter: 'music' })).toEqual([LISTED_SPOTIFY]);
    expect(applyFacets([LISTED_SPOTIFY, LISTED_APPLETV, LISTED_ROUTER_AC1200], [CHIP_GROUP], { filter: 'video' })).toEqual([LISTED_APPLETV]);
  });

  it('counts per chip include zero-count chips', () => {
    const counts = facetCounts([LISTED_CABLE_100, LISTED_CABLE_500], CHIP_GROUP);
    expect(counts.find((chip) => chip.id === 'up-to-500')?.count).toBe(2);
    expect(counts.find((chip) => chip.id === '1-gbps')?.count).toBe(0);
  });
});

describe('chipGroupVisible', () => {
  it('is hidden unless two chips besides All have offers', () => {
    expect(chipGroupVisible([{ id: 'all', count: 5 }, { id: 'music', count: 0 }, { id: 'video', count: 0 }])).toBe(false);
    expect(chipGroupVisible([{ id: 'all', count: 5 }, { id: 'music', count: 2 }, { id: 'video', count: 0 }])).toBe(false);
    expect(chipGroupVisible([{ id: 'all', count: 5 }, { id: 'music', count: 2 }, { id: 'video', count: 3 }])).toBe(true);
  });
});

describe('applyFacets', () => {
  const speed: FacetGroup = { id: 'speed', options: { fast: (offer) => offer.key === LISTED_CABLE_GIG.key } };
  const price: FacetGroup = { id: 'price', options: { cheap: (offer) => (offer.headline.recurring?.centAmount ?? 0) < 5000 } };
  const offers = [LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG];

  it('Facet combination with no matches: two synthetic groups return an empty list', () => {
    expect(applyFacets(offers, [speed, price], { speed: 'fast', price: 'cheap' })).toEqual([]);
  });

  it('two groups combine (both must match)', () => {
    expect(applyFacets(offers, [speed, price], { price: 'cheap' })).toEqual([LISTED_CABLE_100]);
    expect(applyFacets(offers, [speed, price], { speed: 'fast' })).toEqual([LISTED_CABLE_GIG]);
  });

  it('an unknown option or no selection keeps everything', () => {
    expect(applyFacets(offers, [speed], { speed: 'nope' })).toEqual(offers);
    expect(applyFacets(offers, [speed], {})).toEqual(offers);
  });
});
