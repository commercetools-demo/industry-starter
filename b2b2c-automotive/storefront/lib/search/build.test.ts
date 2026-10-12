// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildExactPartRequest, buildSearchRequest, isPartNumberLike, type SearchContext, type SearchExpression } from './build';
import { fitExpression } from './fitment';
import { parseListingParams } from './params';

const ctx: SearchContext = {
  storeId: 'store-1',
  locale: 'en-US',
  currency: 'USD',
  country: 'US',
  branchChannelId: 'ch-branch',
  retailChannelId: 'ch-retail',
  fitKeys: null,
};
const params = (sp: Record<string, string | string[]> = {}) => parseListingParams(sp);
const clauses = (expr: SearchExpression): SearchExpression[] => ('and' in expr ? expr.and : [expr]);
const json = (v: unknown) => JSON.stringify(v);

describe('Listing shows the reseller assortment only: lib/search/build', () => {
  it('always scopes to the store', () => {
    const r = buildSearchRequest(ctx, {}, params());
    expect(clauses(r.query)).toContainEqual({ exact: { field: 'stores', value: 'store-1' } });
    expect(r.limit).toBe(24);
    expect(r.offset).toBe(0);
  });

  it('page 3 offsets by two pages', () => {
    expect(buildSearchRequest(ctx, {}, params({ page: '3' })).offset).toBe(48);
  });

  it('category uses categoriesSubTree', () => {
    const r = buildSearchRequest(ctx, { categoryId: 'cat-1' }, params());
    expect(clauses(r.query)).toContainEqual({ exact: { field: 'categoriesSubTree', value: 'cat-1' } });
  });

  it('fit-only adds the range key or-expression with values and universal-fit', () => {
    const keys = ['VW|Golf|2012|2019|2.0 TDI'];
    const r = buildSearchRequest({ ...ctx, fitKeys: keys }, {}, params());
    expect(clauses(r.query)).toContainEqual(fitExpression(keys));
    expect(json(r.query)).toContain('variants.attributes.fitment-keys');
    expect(json(r.query)).toContain('variants.attributes.universal-fit');
  });

  it('fit=0 adds none', () => {
    const r = buildSearchRequest({ ...ctx, fitKeys: ['k'] }, {}, params({ fit: '0' }));
    expect(json(r.query)).not.toContain('fitment-keys');
    expect(json(r.query)).not.toContain('universal-fit');
  });

  it('no vehicle adds none', () => {
    expect(json(buildSearchRequest(ctx, {}, params()).query)).not.toContain('fitment-keys');
  });

  it('a vehicle outside the vehicle table leaves only the universal branch', () => {
    const r = buildSearchRequest({ ...ctx, fitKeys: [] }, {}, params());
    expect(clauses(r.query)).toContainEqual(fitExpression([]));
  });
});

describe('Filters held in the address: facets and post filters', () => {
  it('brand goes to postFilter so facet counts stay', () => {
    const r = buildSearchRequest(ctx, {}, params({ brand: ['vektra', 'kestrel'] }));
    expect(json(r.query)).not.toContain('brand');
    expect(r.postFilter).toEqual({ exact: { field: 'variants.attributes.brand.key', fieldType: 'enum', values: ['kestrel', 'vektra'] } });
  });

  it('part facets go to postFilter next to the brand', () => {
    const r = buildSearchRequest(ctx, {}, params({ brand: 'vektra', 'attr.position': ['front', 'rear'], 'attr.unknown': 'x' }));
    expect(r.postFilter).toEqual({
      and: [
        { exact: { field: 'variants.attributes.brand.key', fieldType: 'enum', values: ['vektra'] } },
        { exact: { field: 'variants.attributes.position.key', fieldType: 'enum', values: ['front', 'rear'] } },
      ],
    });
  });

  it('pickup filters on the branch channel', () => {
    const r = buildSearchRequest(ctx, {}, params({ pickup: '1' }));
    expect(r.postFilter).toEqual({ exact: { field: 'variants.availability.isOnStockForChannel', value: 'ch-branch' } });
  });

  it('pickup without a branch channel is not applied', () => {
    expect(buildSearchRequest({ ...ctx, branchChannelId: undefined }, {}, params({ pickup: '1' })).postFilter).toBeUndefined();
  });

  it('no filters means no postFilter', () => {
    expect(buildSearchRequest(ctx, {}, params()).postFilter).toBeUndefined();
  });

  it('facets come from the configuration with .key paths and a limit', () => {
    const r = buildSearchRequest(ctx, {}, params());
    expect(r.facets?.map((f) => f.distinct.name)).toEqual(['brand', 'quality-tier', 'position']);
    expect(r.facets?.[0]).toEqual({ distinct: { name: 'brand', field: 'variants.attributes.brand.key', fieldType: 'enum', limit: 50 } });
  });
});

describe('Sort options: lib/search/build sort', () => {
  const nameAsc = { field: 'name', language: 'en-US', order: 'asc' };

  it('popular sort is the seeded rank ascending', () => {
    expect(buildSearchRequest(ctx, {}, params()).sort).toEqual([
      { field: 'variants.attributes.popularity-rank', fieldType: 'number', order: 'asc', mode: 'min' },
      nameAsc,
    ]);
  });

  it('rated sort uses review rating statistics', () => {
    expect(buildSearchRequest(ctx, {}, params({ sort: 'rated' })).sort).toEqual([{ field: 'reviewRatingStatistics.averageRating', order: 'desc' }, nameAsc]);
  });

  it('price sort filters the standalone price scope by currency country and branch channel with base price fallback', () => {
    const [price, tie] = buildSearchRequest(ctx, {}, params({ sort: 'price-asc' })).sort ?? [];
    expect(price).toEqual({
      field: 'variants.prices.centAmount',
      mode: 'min',
      order: 'asc',
      filter: {
        and: [
          { exact: { field: 'variants.prices.currencyCode', value: 'USD' } },
          { exact: { field: 'variants.prices.country', value: 'US' } },
          { or: [{ exact: { field: 'variants.prices.channel', values: ['ch-branch', 'ch-retail'] } }, { not: [{ exists: { field: 'variants.prices.channel' } }] }] },
        ],
      },
    });
    expect(tie).toEqual(nameAsc);
    const desc = buildSearchRequest(ctx, {}, params({ sort: 'price-desc' })).sort?.[0];
    expect(desc).toMatchObject({ order: 'desc', mode: 'max' });
  });

  it('price sort without channels falls back to the base price only', () => {
    const sort = buildSearchRequest({ ...ctx, branchChannelId: undefined, retailChannelId: undefined }, {}, params({ sort: 'price-asc' })).sort?.[0];
    expect(json(sort)).toContain('"not":[{"exists"');
    expect(json(sort)).not.toContain('"values"');
  });

  it('price sort never references an embedded price field', () => {
    const text = json(buildSearchRequest(ctx, {}, params({ sort: 'price-asc' })));
    expect(text).not.toMatch(/masterVariant|priceCurrency|priceCountry|priceChannel/);
    expect(text).toContain('variants.prices.');
  });

  it('a search without an explicit sort is ordered by relevance', () => {
    expect(buildSearchRequest(ctx, {}, params({ q: 'brake' })).sort).toBeUndefined();
    expect(buildSearchRequest(ctx, {}, params({ q: 'brake', sort: 'rated' })).sort?.[0]).toMatchObject({ field: 'reviewRatingStatistics.averageRating' });
  });
});

describe('Search results: text and part numbers', () => {
  it('text search covers name part number and OE numbers', () => {
    const r = buildSearchRequest(ctx, {}, params({ q: 'brake pad' }));
    const text = clauses(r.query).find((c) => 'or' in c);
    expect(text).toEqual({
      or: [
        { fullText: { field: 'name', language: 'en-US', value: 'brake pad', caseInsensitive: true } },
        { exact: { field: 'variants.attributes.part-number', fieldType: 'text', value: 'brake pad', caseInsensitive: true } },
        { exact: { field: 'variants.attributes.oem-numbers', fieldType: 'set_text', value: 'brake pad', caseInsensitive: true } },
      ],
    });
  });

  it('part number like detection', () => {
    for (const q of ['BP-2210-C', 'MLV-BP-41001', 'OE-41001-1', 'ab12', '41001']) expect(isPartNumberLike(q), q).toBe(true);
    for (const q of ['brake', 'front brake pads', 'ab', '12', '', ' ', '-123', 'x;1', '1 2']) expect(isPartNumberLike(q), q).toBe(q === '1 2');
  });

  it('exact part request matches part-number or oem-numbers and ignores fit', () => {
    const r = buildExactPartRequest({ ...ctx, fitKeys: ['k'] }, 'MLV-BP-41001');
    expect(r).not.toBeNull();
    expect(clauses(r!.query)).toContainEqual({ exact: { field: 'stores', value: 'store-1' } });
    expect(json(r!.query)).toContain('variants.attributes.part-number');
    expect(json(r!.query)).toContain('variants.attributes.oem-numbers');
    expect(json(r!.query)).not.toContain('fitment-keys');
    expect(json(r!.query)).not.toContain('universal-fit');
    expect(r!.limit).toBeLessThanOrEqual(24);
  });

  it('exact part request still honours the chosen brand filter', () => {
    const r = buildExactPartRequest(ctx, 'MLV-BP-41001', params({ brand: 'vektra' }));
    expect(r?.postFilter).toEqual({ exact: { field: 'variants.attributes.brand.key', fieldType: 'enum', values: ['vektra'] } });
  });

  it('exact part request is null for words', () => {
    expect(buildExactPartRequest(ctx, 'brake pads')).toBeNull();
  });
});
