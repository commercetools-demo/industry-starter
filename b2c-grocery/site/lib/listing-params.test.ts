import { describe, it, expect } from 'vitest';
import { listingHref, parseListingParams, toQueryString, withListingChange } from './listing-params';

describe('parseListingParams', () => {
  it('Defaults: empty query gives relevance, page 1 and no filters', () => {
    expect(parseListingParams({})).toEqual({ sort: 'relevance', page: 1 });
  });

  it('parses every parameter', () => {
    expect(parseListingParams({ category: 'bakery', price: '500-1500', stock: 'out', sort: 'price-asc', page: '3' })).toEqual({
      category: 'bakery',
      price: '500-1500',
      stock: 'out',
      sort: 'price-asc',
      page: 3,
    });
  });

  it('Invalid values are ignored, not errors', () => {
    expect(parseListingParams({ stock: 'maybe', sort: 'cheapest', page: '0', price: 'a b', category: '../x' })).toEqual({ sort: 'relevance', page: 1 });
    expect(parseListingParams({ page: '-2' }).page).toBe(1);
    expect(parseListingParams({ page: '2.5' }).page).toBe(1);
    expect(parseListingParams({ page: 'abc' }).page).toBe(1);
    expect(parseListingParams({ page: '99999999' }).page).toBe(1);
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseListingParams({ category: ['bakery', 'drinks'] }).category).toBe('bakery');
  });

  it('accepts localized slugs with umlauts', () => {
    expect(parseListingParams({ category: 'milchprodukte-eier' }).category).toBe('milchprodukte-eier');
    expect(parseListingParams({ category: 'brötchen' }).category).toBe('brötchen');
  });
});

describe('toQueryString', () => {
  it('omits defaults', () => {
    expect(toQueryString({ sort: 'relevance', page: 1 })).toBe('');
    expect(toQueryString({})).toBe('');
  });

  it('writes non-default values in a stable order', () => {
    expect(toQueryString({ page: 2, sort: 'newest', stock: 'in', price: 'lt-500', category: 'bakery' })).toBe('category=bakery&price=lt-500&stock=in&sort=newest&page=2');
  });

  it('round trip: parse(toQueryString(x)) equals x', () => {
    const params = { category: 'bakery', price: 'gt-3000', stock: 'in' as const, sort: 'price-desc' as const, page: 4 };
    expect(parseListingParams(Object.fromEntries(new URLSearchParams(toQueryString(params))))).toEqual(params);
  });
});

describe('withListingChange', () => {
  const current = parseListingParams({ category: 'bakery', price: 'lt-500', page: '3' });

  it('resets page to 1 when a filter changes', () => {
    expect(withListingChange(current, { stock: 'in' }).page).toBe(1);
  });

  it('resets page to 1 when the sort changes', () => {
    expect(withListingChange(current, { sort: 'newest' }).page).toBe(1);
  });

  it('keeps an explicit page', () => {
    expect(withListingChange(current, { page: 4 }).page).toBe(4);
  });

  it('removes a filter set to undefined', () => {
    expect(toQueryString(withListingChange(current, { price: undefined }))).toBe('category=bakery');
  });
});

describe('listingHref', () => {
  it('is the bare path for the default listing', () => {
    expect(listingHref({ sort: 'relevance', page: 1 })).toBe('/shop');
  });
  it('appends the query', () => {
    expect(listingHref({ sort: 'newest' })).toBe('/shop?sort=newest');
  });
});
