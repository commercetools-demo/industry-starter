// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { effectiveSort, parseListingParams, removeFilter, serializeListingParams } from './params';

describe('Filters held in the address: lib/search/params', () => {
  it('defaults', () => {
    expect(parseListingParams({})).toEqual({ q: undefined, sort: 'popular', sortGiven: false, page: 1, fit: true, brand: [], pickup: false, attrs: {} });
  });

  it('round trip keeps brand and sort', () => {
    const p = parseListingParams({ brand: ['vektra', 'kestrel'], sort: 'price-asc', pickup: '1', 'attr.position': 'front', q: 'brake', page: '3', fit: '0' });
    const raw: Record<string, string[]> = {};
    for (const [key, value] of serializeListingParams(p)) (raw[key] ??= []).push(value);
    const again = parseListingParams(raw);
    expect(again).toEqual(p);
    expect(p.brand).toEqual(['kestrel', 'vektra']);
    expect(p.sort).toBe('price-asc');
    expect(p.attrs).toEqual({ position: ['front'] });
  });

  it('unknown sort falls back', () => {
    const p = parseListingParams({ sort: 'cheapest' });
    expect(p.sort).toBe('popular');
    expect(p.sortGiven).toBe(false);
  });

  it('page clamps', () => {
    expect(parseListingParams({ page: '0' }).page).toBe(1);
    expect(parseListingParams({ page: '-4' }).page).toBe(1);
    expect(parseListingParams({ page: 'abc' }).page).toBe(1);
    expect(parseListingParams({ page: '2.5' }).page).toBe(1);
    expect(parseListingParams({ page: '7' }).page).toBe(7);
    // Product Search allows offset + limit up to 10000: 400 pages of 24
    expect(parseListingParams({ page: '999999999' }).page).toBe(400);
  });

  it('fit=0 only', () => {
    expect(parseListingParams({ fit: '0' }).fit).toBe(false);
    expect(parseListingParams({ fit: '1' }).fit).toBe(true);
    expect(parseListingParams({ fit: 'false' }).fit).toBe(true);
  });

  it('q is trimmed and cut at 100 characters', () => {
    expect(parseListingParams({ q: '  brake  ' }).q).toBe('brake');
    expect(parseListingParams({ q: '   ' }).q).toBeUndefined();
    expect(parseListingParams({ q: 'x'.repeat(150) }).q).toHaveLength(100);
  });

  it('unknown parameters and malformed filter values are ignored', () => {
    const p = parseListingParams({ foo: 'bar', brand: ['ok-1', 'bad value!', '<script>'], 'attr.Bad Name': 'x', 'attr.position': ['front', '"'] });
    expect(p.brand).toEqual(['ok-1']);
    expect(p.attrs).toEqual({ position: ['front'] });
  });

  it('removeFilter resets page to 1', () => {
    const p = parseListingParams({ brand: ['vektra', 'kestrel'], page: '4', pickup: '1', fit: '0', 'attr.position': ['front', 'rear'] });
    expect(removeFilter(p, 'brand', 'vektra')).toMatchObject({ brand: ['kestrel'], page: 1 });
    expect(removeFilter(p, 'brand').brand).toEqual([]);
    expect(removeFilter(p, 'pickup')).toMatchObject({ pickup: false, page: 1 });
    expect(removeFilter(p, 'fit')).toMatchObject({ fit: true, page: 1 });
    expect(removeFilter(p, 'attr:position', 'front').attrs).toEqual({ position: ['rear'] });
    expect(removeFilter(p, 'attr:position').attrs).toEqual({});
  });

  it('serialization is stable', () => {
    const a = parseListingParams({ sort: 'price-desc', brand: ['vektra', 'kestrel'], pickup: '1' });
    const b = parseListingParams({ pickup: '1', brand: ['kestrel', 'vektra'], sort: 'price-desc' });
    expect(serializeListingParams(a).toString()).toBe(serializeListingParams(b).toString());
    expect(serializeListingParams(a).toString()).toBe('brand=kestrel&brand=vektra&pickup=1&sort=price-desc');
  });

  it('serialization omits defaults', () => {
    expect(serializeListingParams(parseListingParams({ page: '1', sort: 'popular', fit: '1' })).toString()).toBe('');
    expect(serializeListingParams(parseListingParams({ page: '2' })).toString()).toBe('page=2');
  });

  it('relevance order applies to a search without an explicit sort', () => {
    expect(effectiveSort(parseListingParams({ q: 'brake' }))).toBe('relevance');
    expect(effectiveSort(parseListingParams({ q: 'brake', sort: 'popular' }))).toBe('popular');
    expect(effectiveSort(parseListingParams({}))).toBe('popular');
    // an explicit popular sort on a search survives the round trip
    expect(serializeListingParams(parseListingParams({ q: 'brake', sort: 'popular' })).toString()).toBe('q=brake&sort=popular');
    expect(serializeListingParams(parseListingParams({ q: 'brake' })).toString()).toBe('q=brake');
  });
});
