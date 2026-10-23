// The mock search engine is the stand-in for Product Search in browser checks, so it is pinned to the real request builder:
// whatever lib/search/build.ts sends must run, and the answers must be the ones the seed data implies.
import { describe, expect, it } from 'vitest';
import { buildSearchRequest } from '../../lib/search/build';
import { parseListingParams } from '../../lib/search/params';
// @ts-expect-error plain JavaScript module of the mock server
import { DOCS, projectionOf, runSearch } from './mock-catalog.mjs';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const search = (sp: Record<string, string>, scope: 'shop' | 'search' = 'shop', extra: Record<string, unknown> = {}) =>
  runSearch(buildSearchRequest(ctx, { root: null, ...extra }, parseListingParams(sp, scope), { limit: 100, offset: 0, withFacets: true }));

describe('mock catalogue', () => {
  it('has the seed catalogue: 41 products, all sellable in both markets', () => {
    expect(DOCS).toHaveLength(41);
    expect(search({}).total).toBe(41);
    const cad = runSearch(buildSearchRequest({ ...ctx, currency: 'CAD', country: 'CA' }, {}, parseListingParams({}, 'shop'), { limit: 1, offset: 0, withFacets: false }));
    expect(cad.total).toBe(41);
  });

  it('filters by an enum with the postFilter and keeps the group counts comparable', () => {
    const res = search({ f_roast: 'dark' });
    expect(res.total).toBe(4);
    const roast = res.facets.find((f: { name: string }) => f.name === 'roast');
    const counts = Object.fromEntries(roast.buckets.map((b: { key: string; count: number }) => [b.key, b.count]));
    expect(counts.dark).toBe(4);
    expect(counts.light).toBeGreaterThan(0);
    // decaf counts are computed against the roast filter: no dark product is decaf, so there is no `true` bucket
    const decaf = res.facets.find((f: { name: string }) => f.name === 'decaf');
    expect(decaf.buckets.find((x: { key: string }) => x.key === 'true')).toBeUndefined();
  });

  it('counts collection flags and ranges', () => {
    const res = search({});
    const best = res.facets.find((f: { name: string }) => f.name === 'collection:bestseller');
    expect(best.value).toBe(DOCS.filter((d: { common: { badge: string } }) => d.common.badge === 'bestseller').length);
    const price = res.facets.find((f: { name: string }) => f.name === 'price');
    // a product with variants in two bands counts in both
    expect(price.buckets.reduce((n: number, b: { count: number }) => n + b.count, 0)).toBeGreaterThanOrEqual(41);
  });

  it('sorts by price ascending in the market currency', () => {
    const res = search({ sort: 'price-asc' });
    const cents = res.results.map((r: { id: string }) => {
      const d = DOCS.find((x: { id: string }) => x.id === r.id);
      return Math.min(...d.variants.flatMap((v: { prices: { country: string; cents: number }[] }) => v.prices.filter((p) => p.country === 'US').map((p) => p.cents)));
    });
    expect(cents).toEqual([...cents].sort((a: number, b: number) => a - b));
  });

  it('finds an exact SKU first and marks the matching variant; tolerates a typo', () => {
    const res = search({ q: 'mcf-pod-ember-50' }, 'search');
    expect(res.results[0].matchingVariants.matchedVariants[0].sku).toBe('MCF-POD-EMBER-50');
    const typo = search({ q: 'yirgachefe' }, 'search');
    const names = typo.results.map((r: { id: string }) => DOCS.find((d: { id: string }) => d.id === r.id).name['en-US']);
    expect(names).toContain('Ethiopia Yirgacheffe');
    expect(search({ q: 'zzzzqq' }, 'search').total).toBe(0);
  });

  it('filters by rating and by availability at a store channel', () => {
    const rated = search({ f_rating: '4.5' });
    for (const r of rated.results) expect(DOCS.find((d: { id: string }) => d.id === r.id).stats.averageRating).toBeGreaterThanOrEqual(4.5);
    const withStore = runSearch(buildSearchRequest({ ...ctx, storeChannelId: 'chan-1' }, {}, parseListingParams({ avail: '1' }, 'shop'), { limit: 100, offset: 0, withFacets: false }));
    expect(withStore.total).toBeLessThanOrEqual(41);
  });

  it('projects with the selected price and per-store availability', () => {
    const p = projectionOf(DOCS[0], { currency: 'USD', country: 'US', locales: ['en-US'] });
    expect(p.masterVariant.price.value.currencyCode).toBe('USD');
    expect(Object.keys(p.masterVariant.availability.channels)).toHaveLength(6);
    expect(Object.keys(p.name)).toEqual(['en-US']);
  });
});
