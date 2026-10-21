import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

const state = vi.hoisted(() => ({
  languages: ['en-US', 'en-CA'],
  searchCalls: [] as { body: Record<string, unknown> }[],
  searchReplies: [] as unknown[],
  projectionArgs: [] as Record<string, unknown>[],
  projections: [] as unknown[],
  projectionSearchCalled: false,
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    get: () => ({ execute: async () => ({ body: { languages: state.languages } }) }),
    products: () => ({
      search: () => ({
        post: (arg: { body: Record<string, unknown> }) => ({
          execute: async () => { state.searchCalls.push(arg); return { body: state.searchReplies.shift() }; },
        }),
      }),
    }),
    productProjections: () => ({
      search: () => { state.projectionSearchCalled = true; throw new Error('forbidden'); },
      get: (arg: { queryArgs: Record<string, unknown> }) => ({
        execute: async () => { state.projectionArgs.push(arg.queryArgs); return { body: { results: state.projections } }; },
      }),
    }),
  },
}));

import { getListingProjections } from '@/lib/ct/products';
import { searchProducts } from '@/lib/ct/search';
import { parseListingParams } from '@/lib/search/params';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const params = (sp: Record<string, string>, scope: 'shop' | 'search' = 'shop') => parseListingParams(sp, scope);

beforeEach(() => {
  state.languages = ['en-US', 'en-CA'];
  state.searchCalls = [];
  state.searchReplies = [];
  state.projectionArgs = [];
  state.projections = [];
  state.projectionSearchCalled = false;
});

describe('searchProducts', () => {
  it('Page past the last result returns the last page', async () => {
    state.searchReplies = [{ total: 30, results: [] }, { total: 30, results: [{ id: ID(1) }] }];
    const out = await searchProducts(ctx, {}, params({ page: '9' }), {});
    expect(state.searchCalls).toHaveLength(2);
    expect(state.searchCalls[0]!.body.offset).toBe(8 * 24);
    expect(state.searchCalls[1]!.body.offset).toBe(24);
    expect(out).toMatchObject({ status: 'ok', page: 2, redirectToPage: 2, pageCount: 2 });
  });
  it('Unsupported language reports unsupported not empty', async () => {
    state.languages = ['en-US'];
    const out = await searchProducts({ ...ctx, locale: 'en-CA' }, {}, params({}), {});
    expect(out).toEqual({ status: 'unsupported_language' });
    expect(state.searchCalls).toHaveLength(0);
  });
  it('part number first and its variant is marked', async () => {
    state.searchReplies = [{
      total: 2,
      results: [
        { id: ID(1), matchingVariants: { allMatched: false, matchedVariants: [{ id: 2, sku: 'MCF-POD-EMBER-50' }] } },
        { id: ID(2) },
      ],
    }];
    const out = await searchProducts(ctx, {}, params({ q: 'mcf-pod-ember-50' }, 'search'), {});
    expect(state.searchCalls[0]!.body.markMatchingVariants).toBe(true);
    expect(out).toMatchObject({ ids: [ID(1), ID(2)], matchedSkus: { [ID(1)]: 'MCF-POD-EMBER-50' } });
  });
  it('countOnly uses limit 0 and never reruns', async () => {
    state.searchReplies = [{ total: 7, results: [] }];
    const out = await searchProducts(ctx, {}, params({ page: '3' }), { limit: 0, withFacets: false });
    expect(state.searchCalls).toHaveLength(1);
    expect(state.searchCalls[0]!.body).toMatchObject({ limit: 0, offset: 0 });
    expect(state.searchCalls[0]!.body.facets).toBeUndefined();
    expect(out).toMatchObject({ total: 7 });
  });
  it('uses products().search and never productProjections().search', async () => {
    state.searchReplies = [{ total: 0, results: [] }];
    await searchProducts(ctx, {}, params({}), {});
    expect(state.projectionSearchCalled).toBe(false);
    const src = ['search.ts', 'products.ts'].map((f) => readFileSync(join(process.cwd(), 'lib/ct', f), 'utf8')).join('\n');
    expect(src).not.toMatch(/productProjections\(\)\s*\.search|productProjectionParameters/);
  });
});

const projection = (id: string, name: string) => ({
  id, name: { 'en-US': name }, slug: { 'en-US': name.toLowerCase() }, categories: [], attributes: [], variants: [],
  masterVariant: { id: 1, sku: `SKU-${name}`, images: [], attributes: [], price: { id: 'x', value: { type: 'centPrecision', currencyCode: 'USD', centAmount: 500, fractionDigits: 2 } } },
});
const pctx = { ...ctx, categoryName: () => 'Pods' };

describe('getListingProjections', () => {
  it('keeps search order', async () => {
    state.projections = [projection(ID(2), 'B'), projection(ID(1), 'A'), projection(ID(3), 'C')];
    const out = await getListingProjections([ID(3), ID(1), ID(2)], pctx);
    expect(out.map((p) => p.name)).toEqual(['C', 'A', 'B']);
  });
  it('skips a missing projection', async () => {
    state.projections = [projection(ID(1), 'A')];
    expect((await getListingProjections([ID(2), ID(1)], pctx)).map((p) => p.name)).toEqual(['A']);
  });
  it('no ids skips the projection call', async () => {
    expect(await getListingProjections([], pctx)).toEqual([]);
    expect(state.projectionArgs).toHaveLength(0);
  });
  it('ids validated before the predicate', async () => {
    state.projections = [];
    await getListingProjections([ID(1), '1" or id != "', 'x'], pctx);
    expect(state.projectionArgs[0]!.where).toBe(`id in ("${ID(1)}")`);
  });
  it('projection call carries price currency, country and locale projection', async () => {
    await getListingProjections([ID(1)], { ...pctx, country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(state.projectionArgs[0]).toMatchObject({ priceCurrency: 'CAD', priceCountry: 'CA', localeProjection: ['en-CA'], staged: false });
  });
});
