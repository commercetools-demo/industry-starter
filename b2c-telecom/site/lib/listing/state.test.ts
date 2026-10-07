import type { Offer } from '@/lib/types';
import {
  LISTED_ADDONS,
  LISTED_CABLE_100,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_EQUIPMENT,
  LISTED_PHONE_ESSENTIAL,
  TREE,
  usd,
} from './__fixtures__/catalog';
import { pageContaining, resolveListingState } from './state';

const CABLE = [LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG];
const base = { filter: null, sort: 'price-asc', page: 1, offer: null } as const;

/** `count` copies of a 1000-cent add-on with rising prices so the order is known. */
function many(count: number): Offer[] {
  return Array.from({ length: count }, (_, index) => ({
    ...LISTED_ADDONS[0],
    key: `malva-offer-extra-${String(index).padStart(2, '0')}`,
    name: `Extra ${index}`,
    anchors: [`malva-extra-${index}`],
    headline: { recurring: usd(1000 + index), term: null, termMonths: null },
  }));
}

describe('resolveListingState', () => {
  it('Filters survive a reload: same params give same slice and count', () => {
    const params = { filter: 'up-to-500', sort: 'price-desc', page: 1, offer: null } as const;
    const first = resolveListingState({ offers: CABLE, categoryKey: 'malva-cat-cable-internet', roots: TREE, params });
    const again = resolveListingState({ offers: CABLE, categoryKey: 'malva-cat-cable-internet', roots: TREE, params });
    expect(first.result.offers.map((offer) => offer.key)).toEqual(['malva-offer-cable-500', 'malva-offer-cable-100']);
    expect(first.result.total).toBe(2);
    expect(again).toEqual(first);
  });

  it('sorts price-asc by default and price-desc on request (master variant price)', () => {
    const asc = resolveListingState({ offers: [...CABLE].reverse(), categoryKey: 'malva-cat-cable-internet', roots: TREE, params: base });
    expect(asc.result.offers.map((offer) => offer.name)).toEqual(['Cable 100', 'Cable 500', 'Cable Gig']);
    const desc = resolveListingState({ offers: CABLE, categoryKey: 'malva-cat-cable-internet', roots: TREE, params: { ...base, sort: 'price-desc' } });
    expect(desc.result.offers.map((offer) => offer.name)).toEqual(['Cable Gig', 'Cable 500', 'Cable 100']);
  });

  it('13 items make 2 pages: 12 on the first, 1 on the second', () => {
    const offers = many(13);
    const one = resolveListingState({ offers, categoryKey: 'malva-cat-add-ons', roots: TREE, params: base });
    expect(one.result.offers).toHaveLength(12);
    expect(one.result.pageCount).toBe(2);
    const two = resolveListingState({ offers, categoryKey: 'malva-cat-add-ons', roots: TREE, params: { ...base, page: 2 } });
    expect(two.result.offers).toHaveLength(1);
    expect(two.result.page).toBe(2);
  });

  it('Page past the last result: returns the last page that has results', () => {
    const state = resolveListingState({ offers: many(13), categoryKey: 'malva-cat-add-ons', roots: TREE, params: { ...base, page: 99 } });
    expect(state.result.page).toBe(2);
    expect(state.result.offers).toHaveLength(1);
  });

  it('chip counts are over the whole category and a chip of the root is valid in its child categories', () => {
    const state = resolveListingState({ offers: [...LISTED_ADDONS, ...LISTED_EQUIPMENT], categoryKey: 'malva-cat-streaming', roots: TREE, params: base });
    expect(state.chipIds).toEqual(['all', 'music', 'video', 'extras']);
    expect(state.result.chips.find((chip) => chip.id === 'video')?.count).toBe(2);
  });

  it('a listing with no offers reports an explicit empty reason with recovery links', () => {
    const state = resolveListingState({ offers: [], categoryKey: 'malva-cat-cable-internet', roots: TREE, params: base });
    expect(state.result.empty).toBe('no-offers');
    expect(state.result.recoveryLinks?.length).toBeGreaterThan(0);
  });

  it('a chip with no match reports no-match', () => {
    const state = resolveListingState({ offers: [LISTED_CABLE_100], categoryKey: 'malva-cat-cable-internet', roots: TREE, params: { ...base, filter: '1-gbps' } });
    expect(state.result.empty).toBe('no-match');
  });

  it('shows the page that holds the anchored offer', () => {
    const offers = many(13);
    const last = offers[12];
    expect(pageContaining(offers, 'malva-cat-add-ons', TREE, base, last.key)).toBe(2);
    const state = resolveListingState({ offers, categoryKey: 'malva-cat-add-ons', roots: TREE, params: { ...base, offer: last.key } });
    expect(state.result.page).toBe(2);
    expect(state.highlightKey).toBe(last.key);
  });

  it('an explicit page wins over the anchored offer', () => {
    const offers = many(13);
    const state = resolveListingState({ offers, categoryKey: 'malva-cat-add-ons', roots: TREE, params: { ...base, page: 2, offer: offers[0].key } });
    expect(state.result.page).toBe(2);
  });

  it('drops the chip when the anchored offer is hidden by it', () => {
    const state = resolveListingState({
      offers: CABLE,
      categoryKey: 'malva-cat-cable-internet',
      roots: TREE,
      params: { ...base, filter: '1-gbps', offer: LISTED_CABLE_100.key },
    });
    expect(state.filter).toBeNull();
    expect(state.result.offers.map((offer) => offer.key)).toContain(LISTED_CABLE_100.key);
    expect(state.highlightKey).toBe(LISTED_CABLE_100.key);
  });

  it('an unknown offer key is ignored', () => {
    const state = resolveListingState({ offers: CABLE, categoryKey: 'malva-cat-cable-internet', roots: TREE, params: { ...base, offer: 'malva-offer-nope' } });
    expect(state.highlightKey).toBeNull();
    expect(state.result.total).toBe(3);
  });

  it('pageContaining is 1 for an unknown offer', () => {
    expect(pageContaining([LISTED_PHONE_ESSENTIAL], 'malva-cat-phone-plans', TREE, base, 'nope')).toBe(1);
  });
});
