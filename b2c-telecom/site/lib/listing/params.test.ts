import { parseListingParams, toQueryString, withListingChange } from './params';

const CHIPS = ['all', 'up-to-500', '1-gbps'];
const DEFAULTS = { filter: null, sort: 'price-asc', page: 1, offer: null } as const;

function parseQuery(query: string) {
  return parseListingParams(Object.fromEntries(new URLSearchParams(query)), CHIPS);
}

describe('listing params', () => {
  it('Filters survive a reload: filter, sort and page round-trip through the query string', () => {
    const state = { filter: '1-gbps', sort: 'price-desc', page: 3, offer: 'malva-offer-cable-gig' } as const;
    const query = toQueryString(state);
    expect(query).toBe('?filter=1-gbps&sort=price-desc&page=3&offer=malva-offer-cable-gig');
    expect(parseQuery(query)).toEqual(state);
  });

  it('defaults are left out of the query string and an empty query parses to the defaults', () => {
    expect(toQueryString(DEFAULTS)).toBe('');
    expect(toQueryString({ ...DEFAULTS, page: 1 })).toBe('');
    expect(parseQuery('')).toEqual(DEFAULTS);
  });

  it('a chip of another listing, an unknown sort and a bad page are ignored', () => {
    expect(parseQuery('filter=lte&sort=bogus&page=-3')).toEqual(DEFAULTS);
    expect(parseQuery('page=abc').page).toBe(1);
    expect(parseQuery('page=0').page).toBe(1);
    expect(parseQuery('page=2.5').page).toBe(1);
  });

  it('"all" is the same as no filter', () => {
    expect(parseQuery('filter=all').filter).toBeNull();
  });

  it('an offer key with odd characters is ignored', () => {
    expect(parseQuery('offer=<script>').offer).toBeNull();
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseListingParams({ filter: ['gig-not-valid', '1-gbps'] }, CHIPS).filter).toBeNull();
    expect(parseListingParams({ filter: ['1-gbps', 'up-to-500'] }, CHIPS).filter).toBe('1-gbps');
  });

  it('withListingChange resets the page when the filter or the sort changes', () => {
    const current = { filter: null, sort: 'price-asc', page: 3, offer: null } as const;
    expect(withListingChange(current, { filter: 'up-to-500' }).page).toBe(1);
    expect(withListingChange(current, { sort: 'price-desc' }).page).toBe(1);
    expect(withListingChange(current, { page: 2 }).page).toBe(2);
  });

  it('withListingChange drops the offer anchor unless the patch sets it', () => {
    const current = { filter: null, sort: 'price-asc', page: 1, offer: 'malva-offer-cable-gig' } as const;
    expect(withListingChange(current, { filter: '1-gbps' }).offer).toBeNull();
    expect(withListingChange(current, { offer: 'malva-offer-cable-100' }).offer).toBe('malva-offer-cable-100');
  });
});
