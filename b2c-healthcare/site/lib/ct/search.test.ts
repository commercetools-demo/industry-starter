// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const search = vi.fn(() => ({ post }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { products: () => ({ search }) } }));

import { buildClinicMatch, buildNameMatch, buildFacetFilters, buildPaging, buildQuery, buildSearchRequest, buildSellableFilter, buildSort } from './search-query';
import { searchProducts } from './search';

const base = { locale: 'en-US', currency: 'USD', country: 'US' };

describe('switching-region-or-language: Product not sellable in the new region (search)', () => {
  const hasCurrencyFilter = (query: unknown, currency: string) =>
    JSON.stringify(query).includes(JSON.stringify({ exact: { field: 'variants.prices.currencyCode', value: currency } }));

  it('search only lists products with a price in the visitor currency, alone and combined with text and facets', () => {
    expect(hasCurrencyFilter(buildSearchRequest({ ...base, currency: 'EUR', country: 'DE' }).query, 'EUR')).toBe(true);
    const combined = buildSearchRequest({ ...base, text: 'okafor', filters: { specialty: ['general-practice'] } }).query as { and: unknown[] };
    expect(combined.and).toHaveLength(2);
    expect(JSON.stringify(combined)).toContain('fullText');
    expect(hasCurrencyFilter(combined, 'USD')).toBe(true);
  });

  it('a product that is priced only in another currency is not requested for this region', () => {
    expect(hasCurrencyFilter(buildSearchRequest(base).query, 'EUR')).toBe(false);
  });
});

describe('storefront-data-loading: Product Search query builders', () => {
  it('text query: fullText on name in the locale, all words must match', () => {
    expect(buildQuery({ text: ' okafor ', locale: 'en-US' })).toEqual({
      fullText: { field: 'name', language: 'en-US', value: 'okafor', mustMatch: 'all' },
    });
  });

  it('no restriction: no query (match all)', () => {
    expect(buildQuery({ locale: 'en-US', text: '  ' })).toBeUndefined();
  });

  it('facet filters: enum values multi-select, boolean attribute', () => {
    expect(buildFacetFilters({ specialty: ['cardiology', 'dermatology'], modes: ['remote'], rxOnly: false })).toEqual([
      { exact: { field: 'variants.attributes.specialty.key', fieldType: 'enum', values: ['cardiology', 'dermatology'] } },
      { exact: { field: 'variants.attributes.modes.key', fieldType: 'set_enum', values: ['remote'] } },
      { exact: { field: 'variants.attributes.rxOnly', fieldType: 'boolean', value: false } },
    ]);
    expect(buildFacetFilters({ specialty: [] })).toEqual([]);
  });

  it('text + category subtree + facets combine with and/filter', () => {
    expect(buildQuery({ text: 'a', categoryId: 'c1', filters: { modes: ['office'] }, locale: 'en-US' })).toEqual({
      and: [
        { fullText: { field: 'name', language: 'en-US', value: 'a', mustMatch: 'all' } },
        {
          filter: [
            { exact: { field: 'categoriesSubTree', value: 'c1' } },
            { exact: { field: 'variants.attributes.modes.key', fieldType: 'set_enum', values: ['office'] } },
          ],
        },
      ],
    });
  });

  it('sort: relevance none, name by language, price min/max in the currency', () => {
    expect(buildSort('relevance', 'en-US', 'USD')).toBeUndefined();
    expect(buildSort('name-desc', 'en-US', 'USD')).toEqual([{ field: 'name', language: 'en-US', order: 'desc' }]);
    expect(buildSort('price-asc', 'en-US', 'USD')).toEqual([
      {
        field: 'variants.prices.centAmount',
        mode: 'min',
        order: 'asc',
        filter: { exact: { field: 'variants.prices.currencyCode', value: 'USD' } },
      },
    ]);
  });

  it('paging: 1-based page to offset, clamped', () => {
    expect(buildPaging(3, 20)).toEqual({ limit: 20, offset: 40 });
    expect(buildPaging(0, 1000)).toEqual({ limit: 100, offset: 0 });
    expect(buildPaging()).toEqual({ limit: 20, offset: 0 });
  });

  it('Clinic search: full text on the searchable clinicName attribute, all words must match, and it is OR-ed into the name match', () => {
    expect(buildClinicMatch('  Austin Central ')).toEqual({ fullText: { field: 'variants.attributes.clinicName', fieldType: 'text', value: 'Austin Central', mustMatch: 'all' } });
    const q = buildNameMatch('Austin', 'en-US', [buildClinicMatch('Austin')]) as { or: unknown[] };
    expect(q.or).toHaveLength(3);
    expect(JSON.stringify(q.or.at(-1))).toContain('variants.attributes.clinicName');
  });

  it('full request: price selection with channel, facets, locale projection', () => {
    const request = buildSearchRequest({ ...base, text: 'x', page: 2, pageSize: 10, priceChannelId: 'ch1' });
    expect(request).toMatchObject({
      limit: 10,
      offset: 10,
      productProjectionParameters: { priceCurrency: 'USD', priceCountry: 'US', priceChannel: 'ch1', localeProjection: ['en-US'] },
    });
    expect(request.facets?.map((f) => (f as { distinct: { name: string } }).distinct.name)).toEqual([
      'specialty',
      'city',
      'modes',
    ]);
    // Nothing else restricts: the only restriction is "has a price in the visitor's currency".
    expect(buildSearchRequest(base).query).toEqual(buildSellableFilter('USD'));
  });
});

describe('storefront-data-loading: searchProducts wrapper', () => {
  beforeEach(() => {
    post.mockReset();
    search.mockClear();
  });

  it('posts the body to products().search() and maps projections and facets', async () => {
    post.mockReturnValue({
      execute: async () => ({
        body: {
          total: 2,
          offset: 0,
          limit: 20,
          results: [{ id: 'a', productProjection: { id: 'a' } }, { id: 'b' }],
          facets: [{ name: 'modes', buckets: [{ key: 'remote', count: 3 }] }, { name: 'n', value: 1 }],
        },
      }),
    });
    const page = await searchProducts(base, (p) => p.id);
    expect(search).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0].body.limit).toBe(20);
    expect(page).toEqual({
      items: ['a'],
      total: 2,
      offset: 0,
      limit: 20,
      facets: [{ name: 'modes', buckets: [{ value: 'remote', count: 3 }] }],
    });
  });

  it('never uses the deprecated productProjections().search()', () => {
    for (const file of ['search.ts', 'search-query.ts']) {
      const code = readFileSync(join(import.meta.dirname, file), 'utf8');
      expect(code).not.toMatch(/productProjections\(\)/);
    }
  });
});
