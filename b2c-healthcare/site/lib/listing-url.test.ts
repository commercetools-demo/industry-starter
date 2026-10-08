import { describe, expect, it } from 'vitest';
import { clampPage, cleanQuery, hasActiveFilters, listingHref, pageCountOf, parseListingState, serializeListingState } from '@/lib/listing-url';

describe('product-listing-page: request-derived filter and page state', () => {
  it.each([
    ['q=okafor&specialty=cardiology&city=austin&today=1&page=3', { q: 'okafor', specialty: 'cardiology', city: 'austin', today: true, page: 3 }],
    ['page=0', { q: '', specialty: '', city: '', today: false, page: 1 }],
    ['page=abc&today=0', { q: '', specialty: '', city: '', today: false, page: 1 }],
    ['specialty=Bad%20Value&city=../x', { q: '', specialty: '', city: '', today: false, page: 1 }],
    ['specialty=DERMATOLOGY', { q: '', specialty: 'dermatology', city: '', today: false, page: 1 }],
    ['q=%20%20a%20%20b%0A', { q: 'a b', specialty: '', city: '', today: false, page: 1 }],
  ])('parses %s', (query, expected) => {
    expect(parseListingState(new URLSearchParams(query))).toEqual(expected);
  });

  it('Filters survive a reload: parse(serialize(state)) is the identity', () => {
    const state = { q: 'dr reyes', specialty: 'dermatology', city: 'new-york', today: true, page: 2 };
    const url = serializeListingState(state);
    expect(parseListingState(new URLSearchParams(url))).toEqual(state);
    expect(serializeListingState(parseListingState(new URLSearchParams(url)))).toBe(url);
    expect(listingHref('/doctors/office', state)).toBe(`/doctors/office?${url}`);
  });

  it('defaults are omitted and arrays take the first value', () => {
    expect(serializeListingState({ page: 1, today: false })).toBe('');
    expect(listingHref('/doctors/remote', {})).toBe('/doctors/remote');
    expect(parseListingState({ q: ['a', 'b'], page: ['2'] })).toMatchObject({ q: 'a', page: 2 });
  });

  it('caps the query length', () => {
    expect(cleanQuery('x'.repeat(500))).toHaveLength(80);
  });

  it.each([
    [0, 0, 9, 1],
    [1, 8, 9, 1],
    [5, 8, 9, 1],
    [2, 10, 9, 2],
    [99, 10, 9, 2],
    [3, 27, 9, 3],
    [-4, 27, 9, 1],
  ])('Page past the last result: page %i of %i results (size %i) -> page %i', (page, total, size, expected) => {
    expect(clampPage(page, total, size)).toBe(expected);
  });

  it('page count', () => {
    expect(pageCountOf(0, 9)).toBe(1);
    expect(pageCountOf(19, 9)).toBe(3);
  });

  it('active filters ignore the city in remote mode', () => {
    const base = { q: '', specialty: '', city: 'austin', today: false, page: 1 };
    expect(hasActiveFilters(base, 'remote')).toBe(false);
    expect(hasActiveFilters(base, 'office')).toBe(true);
  });
});
