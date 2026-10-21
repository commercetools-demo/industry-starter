// Product Search request builder (workstream G, 3.4). Pure: returns the JSON body for `products().search().post`.
// Never builds a productProjections search and never sets productProjectionParameters (D-023).
import {
  BADGE_FIELD, FACETS, SUBSCRIBABLE_FIELD, facetApplies,
  type CategoryRoot, type FacetDef,
} from '@/lib/search/facet-config';
import type { ListingParams } from '@/lib/search/params';
import { priceBandById, priceBands } from '@/lib/search/price-bands';

export type SearchClause = Record<string, unknown>;

export interface SearchRequestBody {
  query: SearchClause;
  postFilter?: SearchClause;
  facets?: SearchClause[];
  sort: SearchClause[];
  limit: number;
  offset: number;
  markMatchingVariants?: boolean;
}

export interface SearchContext { locale: string; currency: string; country: string; storeChannelId?: string }

export interface SearchScope {
  /** Category id for `categoriesSubTree`; absent on /shop and /search. */
  categoryId?: string;
  /** Root of the category scope; narrows which facets are requested. */
  root?: CategoryRoot | null;
  /** Category key (URL value of the `category` facet) to id. */
  categoryIdByKey?: Record<string, string>;
}

export interface BuildOptions { limit: number; offset: number; withFacets: boolean }

export const PAGE_SIZE = 24;
/** The fuzzy branch is added only for queries longer than this (spec: "more than five characters"). */
export const FUZZY_MIN_LENGTH = 5;

const exact = (ctx: SearchContext, field: string, value: string | boolean | number, fieldType?: string): SearchClause => ({
  exact: { field, value, ...(fieldType ? { fieldType } : {}), language: ctx.locale },
});

/** Currency and country in one `and`, so both match the same price object. */
export const marketClause = (ctx: SearchContext): SearchClause => ({
  and: [
    { exact: { field: 'variants.prices.currencyCode', value: ctx.currency } },
    { exact: { field: 'variants.prices.country', value: ctx.country } },
  ],
});

function anyOf(clauses: SearchClause[]): SearchClause | undefined {
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? (clauses[0] as SearchClause) : { or: clauses };
}

/** The postFilter clause of one facet group; undefined when nothing selected or nothing maps. */
export function groupClause(def: FacetDef, values: string[], ctx: SearchContext, scope: SearchScope): SearchClause | undefined {
  switch (def.name) {
    case 'category': {
      const ids = values.map((k) => scope.categoryIdByKey?.[k]).filter((id): id is string => Boolean(id));
      return anyOf(ids.map((id) => ({ exact: { field: 'categoriesSubTree', value: id } })));
    }
    case 'intensity':
      return anyOf(values.map((v) => ({ range: { field: def.field, gte: Number(v), lt: Number(v) + 1 } })));
    case 'price': {
      const band = priceBandById(ctx.currency, values[0] ?? '');
      if (!band) return undefined;
      return {
        and: [
          { range: { field: def.field, ...(band.from !== undefined ? { gte: band.from } : {}), ...(band.to !== undefined ? { lt: band.to } : {}) } },
          { exact: { field: 'variants.prices.currencyCode', value: ctx.currency } },
          { exact: { field: 'variants.prices.country', value: ctx.country } },
        ],
      };
    }
    case 'rating':
      return { range: { field: def.field, gte: Number(values[0]) } };
    case 'collection':
      return anyOf(values.map((v) => collectionValueClause(v, ctx)));
    default:
      return anyOf(values.map((v) => exact(ctx, def.field, def.fieldType === 'boolean' ? v === 'true' : v, def.fieldType)));
  }
}

function collectionValueClause(value: string, ctx: SearchContext): SearchClause {
  if (value === 'subscribable') return exact(ctx, SUBSCRIBABLE_FIELD, true, 'boolean');
  return exact(ctx, BADGE_FIELD, value, 'enum');
}

function selectedClauses(p: ListingParams, ctx: SearchContext, scope: SearchScope, skip?: string): SearchClause[] {
  const out: SearchClause[] = [];
  for (const def of FACETS) {
    if (def.name === skip) continue;
    const values = p.facets[def.name];
    if (!values?.length) continue;
    const clause = groupClause(def, values, ctx, scope);
    if (clause) out.push(clause);
  }
  return out;
}

function andOf(clauses: SearchClause[]): SearchClause | undefined {
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? (clauses[0] as SearchClause) : { and: clauses };
}

function textClause(q: string, ctx: SearchContext): SearchClause {
  const branches: SearchClause[] = [
    { exact: { field: 'variants.sku', value: q, caseInsensitive: true, boost: 10 } },
    { fullText: { field: 'name', language: ctx.locale, value: q, boost: 3 } },
  ];
  if (q.length > FUZZY_MIN_LENGTH) {
    branches.push({ fuzzy: { field: 'name', language: ctx.locale, value: q, level: 2, mustMatch: 'all' } });
  }
  return { or: branches };
}

function buildQuery(ctx: SearchContext, scope: SearchScope, p: ListingParams): SearchClause {
  const filter: SearchClause[] = [];
  if (scope.categoryId) filter.push({ exact: { field: 'categoriesSubTree', value: scope.categoryId } });
  filter.push(marketClause(ctx));
  if (p.avail && ctx.storeChannelId) {
    filter.push({ exact: { field: 'variants.availability.isOnStockForChannel', value: ctx.storeChannelId } });
  }
  return p.q ? { and: [{ filter }, textClause(p.q, ctx)] } : { filter };
}

function buildFacets(ctx: SearchContext, scope: SearchScope, p: ListingParams): SearchClause[] {
  const root = scope.root ?? null;
  const facets: SearchClause[] = [];
  for (const def of FACETS) {
    if (!facetApplies(def, root)) continue;
    const others = selectedClauses(p, ctx, scope, def.name);
    const filter = (extra: SearchClause[] = []) => {
      const f = andOf([...others, ...extra]);
      return f ? { filter: f } : {};
    };
    if (def.name === 'collection') {
      for (const v of def.values ?? []) {
        facets.push({ count: { name: `collection:${v}`, ...filter([collectionValueClause(v, ctx)]) } });
      }
    } else if (def.name === 'intensity') {
      facets.push({
        ranges: {
          name: def.name, field: def.field,
          ranges: (def.values ?? []).map((v) => ({ key: v, from: Number(v), to: Number(v) + 1 })),
          ...filter(),
        },
      });
    } else if (def.name === 'price') {
      facets.push({
        ranges: {
          name: def.name, field: def.field,
          ranges: priceBands(ctx.currency).map((b) => ({ key: b.id, ...(b.from !== undefined ? { from: b.from } : {}), ...(b.to !== undefined ? { to: b.to } : {}) })),
          ...filter([marketClause(ctx)]),
        },
      });
    } else if (def.name === 'rating') {
      facets.push({
        ranges: { name: def.name, field: def.field, ranges: [{ key: '4.5', from: 4.5 }, { key: '4.0', from: 4.0 }], ...filter() },
      });
    } else {
      facets.push({
        distinct: {
          name: def.name, field: def.field, fieldType: def.fieldType, language: ctx.locale,
          limit: def.limit ?? 50, level: 'products', ...filter(),
        },
      });
    }
  }
  return facets;
}

function buildSort(ctx: SearchContext, p: ListingParams): SearchClause[] {
  const byName: SearchClause = { field: 'name', language: ctx.locale, order: 'asc' };
  const priceFilter = { and: [
    { exact: { field: 'variants.prices.currencyCode', value: ctx.currency } },
    { exact: { field: 'variants.prices.country', value: ctx.country } },
  ] };
  switch (p.sort) {
    case 'relevance':
      return p.q ? [{ field: 'score', order: 'desc' }, { field: 'id', order: 'asc' }] : [{ field: 'createdAt', order: 'desc' }, byName];
    case 'price-asc':
      return [{ field: 'variants.prices.centAmount', mode: 'min', order: 'asc', filter: priceFilter }, byName];
    case 'price-desc':
      return [{ field: 'variants.prices.centAmount', mode: 'max', order: 'desc', filter: priceFilter }, byName];
    case 'rating':
      return [
        { field: 'reviewRatingStatistics.averageRating', order: 'desc' },
        { field: 'reviewRatingStatistics.count', order: 'desc' },
        byName,
      ];
    default:
      return [{ field: 'createdAt', order: 'desc' }, byName];
  }
}

export function buildSearchRequest(ctx: SearchContext, scope: SearchScope, p: ListingParams, opts: BuildOptions): SearchRequestBody {
  const post = andOf(selectedClauses(p, ctx, scope));
  return {
    query: buildQuery(ctx, scope, p),
    ...(post ? { postFilter: post } : {}),
    ...(opts.withFacets ? { facets: buildFacets(ctx, scope, p) } : {}),
    sort: buildSort(ctx, p),
    limit: opts.limit,
    offset: opts.offset,
    ...(p.q ? { markMatchingVariants: true } : {}),
  };
}
