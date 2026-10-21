import { describe, expect, it } from 'vitest';
import { clearAllFilters, parseListingParams, removeFilter, serializeListingParams, toggleFacetValue } from '@/lib/search/params';

describe('listing params', () => {
  it('defaults per scope', () => {
    expect(parseListingParams({}, 'shop')).toMatchObject({ sort: 'featured', page: 1, avail: false, facets: {} });
    expect(parseListingParams({}, 'category').sort).toBe('featured');
    expect(parseListingParams({ q: 'ember' }, 'search').sort).toBe('relevance');
  });
  it('round trip keeps facets and sort', () => {
    const p = parseListingParams({ f_roast: 'dark,medium', sort: 'price-asc', page: '3', avail: '1', q: 'x' }, 'shop');
    const again = parseListingParams(Object.fromEntries(serializeListingParams(p, 'shop')), 'shop');
    expect(again).toEqual(p);
  });
  it('unknown sort falls back', () => {
    const p = parseListingParams({ sort: 'cheapest' }, 'shop');
    expect(p.sort).toBe('featured');
    expect(p.sortGiven).toBe(false);
    expect(parseListingParams({ sort: 'relevance' }, 'shop').sort).toBe('featured');
  });
  it('page clamps to 1 and 400', () => {
    expect(parseListingParams({ page: '0' }, 'shop').page).toBe(1);
    expect(parseListingParams({ page: 'abc' }, 'shop').page).toBe(1);
    expect(parseListingParams({ page: '-4' }, 'shop').page).toBe(1);
    expect(parseListingParams({ page: '9999' }, 'shop').page).toBe(400);
  });
  it('unknown facet and value dropped', () => {
    const p = parseListingParams({ f_roast: 'dark,burnt', f_nope: 'x', f_intensity: '14,8', f_decaf: 'false' }, 'shop');
    expect(p.facets).toEqual({ roast: ['dark'], intensity: ['8'] });
  });
  it('removeFilter resets page', () => {
    const p = parseListingParams({ f_roast: 'dark,light', page: '4' }, 'shop');
    const r = removeFilter(p, 'roast', 'dark');
    expect(r.facets).toEqual({ roast: ['light'] });
    expect(r.page).toBe(1);
    expect(removeFilter(r, 'roast').facets).toEqual({});
  });
  it('single facet re-click clears', () => {
    const p = parseListingParams({}, 'shop');
    const on = toggleFacetValue(p, 'rating', '4.5', 'single');
    expect(on.facets.rating).toEqual(['4.5']);
    expect(toggleFacetValue(on, 'rating', '4.0', 'single').facets.rating).toEqual(['4.0']);
    expect(toggleFacetValue(on, 'rating', '4.5', 'single').facets).toEqual({});
  });
  it('serialization is stable and omits defaults', () => {
    const p = parseListingParams({ f_roast: 'dark', avail: '1', sort: 'featured', page: '1' }, 'shop');
    expect(serializeListingParams(p, 'shop').toString()).toBe('avail=1&f_roast=dark');
    expect(serializeListingParams(parseListingParams({ sort: 'rating', f_brew: 'filter', q: 'a' }, 'shop'), 'shop').toString()).toBe('f_brew=filter&q=a&sort=rating');
  });
  it('q is trimmed and cut at 100', () => {
    expect(parseListingParams({ q: '  ember  ' }, 'search').q).toBe('ember');
    expect(parseListingParams({ q: 'a'.repeat(300) }, 'search').q).toHaveLength(100);
    expect(parseListingParams({ q: '   ' }, 'search').q).toBeUndefined();
  });
  it('Clear all keeps q and drops facets, avail, sort and page', () => {
    const p = parseListingParams({ q: 'x', f_roast: 'dark', avail: '1', sort: 'rating', page: '2' }, 'search');
    const c = clearAllFilters(p, 'search');
    expect(serializeListingParams(c, 'search').toString()).toBe('q=x');
  });
});
