import { describe, expect, it } from 'vitest';
import { buildSearchRequest, type SearchClause } from '@/lib/search/build';
import { parseListingParams } from '@/lib/search/params';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US', storeChannelId: 'chan-2' };
const opts = { limit: 24, offset: 0, withFacets: true };
const params = (sp: Record<string, string>, scope: 'shop' | 'search' | 'category' = 'shop') => parseListingParams(sp, scope);
const json = (x: unknown) => JSON.stringify(x);
const facet = (req: ReturnType<typeof buildSearchRequest>, name: string) =>
  (req.facets ?? []).map((f) => Object.values(f)[0] as SearchClause).find((f) => f.name === name) as SearchClause;

describe('buildSearchRequest', () => {
  it('category scope uses categoriesSubTree', () => {
    const req = buildSearchRequest(ctx, { categoryId: 'cat-1' }, params({}, 'category'), opts);
    expect(json(req.query)).toContain('{"exact":{"field":"categoriesSubTree","value":"cat-1"}}');
  });
  it('market filter is currency and country', () => {
    const req = buildSearchRequest(ctx, {}, params({}), opts);
    expect(json(req.query)).toContain('"variants.prices.currencyCode","value":"USD"');
    expect(json(req.query)).toContain('"variants.prices.country","value":"US"');
  });
  it('avail goes to the query not postFilter', () => {
    const req = buildSearchRequest(ctx, {}, params({ avail: '1' }), opts);
    expect(json(req.query)).toContain('variants.availability.isOnStockForChannel');
    expect(json(req.query)).toContain('chan-2');
    expect(req.postFilter).toBeUndefined();
    const none = buildSearchRequest({ ...ctx, storeChannelId: undefined }, {}, params({ avail: '1' }), opts);
    expect(json(none.query)).not.toContain('isOnStockForChannel');
  });
  it('text clause has exact sku boost fullText and fuzzy only above five characters', () => {
    const short = buildSearchRequest(ctx, {}, params({ q: 'ember' }, 'search'), opts);
    expect(json(short.query)).toContain('"boost":10');
    expect(json(short.query)).toContain('"fullText"');
    expect(json(short.query)).not.toContain('fuzzy');
    const long = buildSearchRequest(ctx, {}, params({ q: 'embers' }, 'search'), opts);
    expect(json(long.query)).toContain('"fuzzy"');
    expect(long.markMatchingVariants).toBe(true);
    expect(long.sort[0]).toEqual({ field: 'score', order: 'desc' });
  });
  it("facets carry the other groups' filters and not their own", () => {
    const req = buildSearchRequest(ctx, { root: null }, params({ f_roast: 'dark', f_decaf: 'true' }), opts);
    const roast = facet(req, 'roast');
    expect(json(roast.filter)).toContain('decaf');
    expect(json(roast.filter)).not.toContain('roast.key');
    const decaf = facet(req, 'decaf');
    expect(json(decaf.filter)).toContain('roast.key');
    expect(json(decaf.filter)).not.toContain('attributes.decaf');
    const origin = facet(req, 'origin');
    expect(json(origin.filter)).toContain('roast.key');
    expect(json(origin.filter)).toContain('attributes.decaf');
  });
  it('selected groups go to postFilter', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_roast: 'dark,light', f_decaf: 'true' }), opts);
    expect(json(req.postFilter)).toContain('"or"');
    expect(json(req.postFilter)).toContain('"value":true');
    expect(json(req.query)).not.toContain('roast');
  });
  it('category facet maps keys to ids in the postFilter', () => {
    const req = buildSearchRequest(ctx, { categoryIdByKey: { 'mcf-cat-pods-original': 'id-9' } }, params({ f_category: 'mcf-cat-pods-original' }), opts);
    expect(json(req.postFilter)).toBe('{"exact":{"field":"categoriesSubTree","value":"id-9"}}');
  });
  it('price sort filters currency and country only', () => {
    const req = buildSearchRequest(ctx, {}, params({ sort: 'price-asc' }), opts);
    const s = req.sort[0] as { mode: string; filter: unknown };
    expect(s.mode).toBe('min');
    expect(json(s.filter)).not.toMatch(/attributes|categories/);
    expect(json(s.filter)).toContain('currencyCode');
    const desc = buildSearchRequest(ctx, {}, params({ sort: 'price-desc' }), opts);
    expect(desc.sort[0]).toMatchObject({ mode: 'max', order: 'desc' });
  });
  it('rating sort uses review statistics', () => {
    const req = buildSearchRequest(ctx, {}, params({ sort: 'rating' }), opts);
    expect(json(req.sort)).toContain('reviewRatingStatistics.averageRating');
    expect(json(req.sort)).toContain('reviewRatingStatistics.count');
  });
  it('rating facet and filter use averageRating ranges', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_rating: '4.5' }), opts);
    expect(req.postFilter).toEqual({ range: { field: 'reviewRatingStatistics.averageRating', gte: 4.5 } });
    expect(json(facet(req, 'rating').ranges)).toContain('"from":4.5');
  });
  it('intensity maps to ranges', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_intensity: '8' }), opts);
    expect(req.postFilter).toEqual({ range: { field: 'variants.attributes.intensity', gte: 8, lt: 9 } });
    expect((facet(req, 'intensity').ranges as unknown[]).length).toBe(13);
  });
  it('price band is a range with currency and country', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_price: 'p1' }), opts);
    expect(json(req.postFilter)).toContain('"gte":1000,"lt":2500');
    expect(json(req.postFilter)).toContain('currencyCode');
  });
  it('collection maps badges and subscribable', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_collection: 'bestseller,subscribable' }), opts);
    expect(json(req.postFilter)).toContain('badge.key');
    expect(json(req.postFilter)).toContain('subscribable');
  });
  it('no productProjectionParameters key anywhere', () => {
    const req = buildSearchRequest(ctx, { root: null }, params({ q: 'abcdefg', f_roast: 'dark', sort: 'rating' }, 'search'), opts);
    expect(json(req)).not.toContain('productProjectionParameters');
  });
  it('language on distinct facets and exact filters', () => {
    const req = buildSearchRequest(ctx, {}, params({ f_roast: 'dark' }), opts);
    expect(json(req.postFilter)).toContain('"language":"en-US"');
    expect(facet(req, 'roast').language).toBe('en-US');
  });
  it('facets are skipped for countOnly style requests and limited by scope root', () => {
    expect(buildSearchRequest(ctx, {}, params({}), { ...opts, withFacets: false }).facets).toBeUndefined();
    const pods = buildSearchRequest(ctx, { root: 'pods' }, params({}), opts);
    expect(facet(pods, 'roast')).toBeUndefined();
    expect(facet(pods, 'intensity')).toBeDefined();
  });
  it('offset and limit pass through', () => {
    const req = buildSearchRequest(ctx, {}, params({}), { limit: 24, offset: 48, withFacets: false });
    expect([req.limit, req.offset]).toEqual([24, 48]);
  });
});
