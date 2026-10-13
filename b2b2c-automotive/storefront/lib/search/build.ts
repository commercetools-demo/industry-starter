// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Product Search request of the listing (workstream L). Pure: no SDK import, no server-only; `lib/ct/search.ts` sends it.
// Syntax confirmed against the commercetools docs on 2026-10-12 (see the notes of workstream L): `categoriesSubTree` (exact
// value or values), `reviewRatingStatistics.averageRating` sort, sort `filter` with a compound expression, `exact` with
// `values`, `variants.availability.isOnStockForChannel`, facets scoped to the query by default. A sort never drops a product:
// products without a sort value come last, so no `missing` key exists (and the SDK type has none).
import { FACETS, ATTRIBUTE_FACETS } from './facet-config';
import { fitScope, type FitExactExpression, type FitQuery } from './fitment';
import { effectiveSort, PAGE_SIZE, type ListingParams } from './params';

/** Scope of one search: the store, the market, the branch and the active vehicle's range keys. */
export interface SearchContext {
  storeId: string;
  /** Product text language, for example `en-US`. */
  locale: string;
  currency: string;
  country: string;
  /** Supply channel and first price channel of the selected branch (`getBranchScope`); undefined for a store without branches. */
  branchChannelId: string | undefined;
  /** Second price channel: the store's retail channel. */
  retailChannelId: string | undefined;
  /** The active vehicle's expanded range keys (`getActiveVehicle().fitKeys`), null without a vehicle. */
  fitKeys: string[] | null;
}

export interface ListingScope {
  categoryId?: string;
}

interface Exact {
  field: string;
  fieldType?: string;
  value?: string | boolean;
  values?: string[];
  caseInsensitive?: boolean;
}
/** The slice of the commercetools search query language this module builds. */
export type SearchExpression =
  | { and: SearchExpression[] }
  | { or: SearchExpression[] }
  | { not: SearchExpression[] }
  | { exact: Exact }
  | { exists: { field: string } }
  | { fullText: { field: string; language: string; value: string; caseInsensitive?: boolean } }
  | FitQuery
  | FitExactExpression;

export interface SearchSort {
  field: string;
  language?: string;
  fieldType?: string;
  order: 'asc' | 'desc';
  mode?: 'min' | 'max';
  filter?: SearchExpression;
}
export interface SearchFacet {
  distinct: { name: string; field: string; fieldType: string; limit: number };
}
export interface SearchRequest {
  query: SearchExpression;
  postFilter?: SearchExpression;
  facets?: SearchFacet[];
  sort?: SearchSort[];
  limit: number;
  offset: number;
}

const PART_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{2,}$/;
const PART_NUMBER_FIELD = 'variants.attributes.part-number';
const OEM_NUMBERS_FIELD = 'variants.attributes.oem-numbers';
const EXACT_LIMIT = 8;

/** A query that can be a part or OE number: three or more characters from the set, with at least one digit. */
export function isPartNumberLike(q: string): boolean {
  const value = q.trim();
  return PART_NUMBER.test(value) && /\d/.test(value);
}

const exact = (field: string, value: string | boolean, extra: Partial<Exact> = {}): SearchExpression => ({ exact: { field, ...extra, value } });
const exactValues = (field: string, values: string[], extra: Partial<Exact> = {}): SearchExpression => ({ exact: { field, ...extra, values } });
const partNumberClauses = (q: string): SearchExpression[] => [
  exact(PART_NUMBER_FIELD, q, { fieldType: 'text', caseInsensitive: true }),
  exact(OEM_NUMBERS_FIELD, q, { fieldType: 'set_text', caseInsensitive: true }),
];

const nameAsc = (locale: string): SearchSort => ({ field: 'name', language: locale, order: 'asc' });

function priceSort(ctx: SearchContext, order: 'asc' | 'desc'): SearchSort {
  const channels = [ctx.branchChannelId, ctx.retailChannelId].filter((c): c is string => Boolean(c));
  const noChannel: SearchExpression = { not: [{ exists: { field: 'variants.prices.channel' } }] };
  return {
    field: 'variants.prices.centAmount',
    mode: order === 'asc' ? 'min' : 'max',
    order,
    filter: {
      and: [
        exact('variants.prices.currencyCode', ctx.currency),
        exact('variants.prices.country', ctx.country),
        channels.length > 0 ? { or: [exactValues('variants.prices.channel', channels), noChannel] } : noChannel,
      ],
    },
  };
}

function sortFor(ctx: SearchContext, p: ListingParams): SearchSort[] | undefined {
  switch (effectiveSort(p)) {
    case 'relevance':
      return undefined;
    case 'popular':
      return [{ field: 'variants.attributes.popularity-rank', fieldType: 'number', order: 'asc', mode: 'min' }, nameAsc(ctx.locale)];
    case 'price-asc':
      return [priceSort(ctx, 'asc'), nameAsc(ctx.locale)];
    case 'price-desc':
      return [priceSort(ctx, 'desc'), nameAsc(ctx.locale)];
    case 'rated':
      return [{ field: 'reviewRatingStatistics.averageRating', order: 'desc' }, nameAsc(ctx.locale)];
  }
}

function postFilterFor(ctx: SearchContext, p: ListingParams): SearchExpression | undefined {
  const parts: SearchExpression[] = [];
  const brand = FACETS.find((f) => f.name === 'brand');
  if (brand && p.brand.length > 0) parts.push(exactValues(brand.field, p.brand, { fieldType: brand.fieldType }));
  // Only configured attribute facets are applied; any other `attr.*` in the address is ignored.
  for (const facet of ATTRIBUTE_FACETS) {
    const selected = p.attrs[facet.name];
    if (selected && selected.length > 0) parts.push(exactValues(facet.field, selected, { fieldType: facet.fieldType }));
  }
  if (p.pickup && ctx.branchChannelId) parts.push(exact('variants.availability.isOnStockForChannel', ctx.branchChannelId));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : { and: parts };
}

/** The clauses every listing query shares: category, text and fit. The store clause is added by the caller that has a store. */
function scopeClauses(ctx: Pick<SearchContext, 'locale' | 'fitKeys'>, scope: ListingScope, p: ListingParams): SearchExpression[] {
  const and: SearchExpression[] = [];
  if (scope.categoryId) and.push(exact('categoriesSubTree', scope.categoryId));
  if (p.q) {
    and.push({ or: [{ fullText: { field: 'name', language: ctx.locale, value: p.q, caseInsensitive: true } }, ...partNumberClauses(p.q)] });
  }
  // Range keys, not a vehicle id (J): in `query` so facet counts reflect fit.
  const fit = fitScope(ctx.fitKeys, p.fit ? 'fit-only' : 'all');
  if (fit) and.push(fit);
  return and;
}

export function buildSearchRequest(ctx: SearchContext, scope: ListingScope, p: ListingParams): SearchRequest {
  return {
    query: { and: [exact('stores', ctx.storeId), ...scopeClauses(ctx, scope, p)] },
    postFilter: postFilterFor(ctx, p),
    facets: FACETS.map((f) => ({ distinct: { name: f.name, field: f.field, fieldType: f.fieldType, limit: 50 } })),
    sort: sortFor(ctx, p),
    limit: PAGE_SIZE,
    offset: (p.page - 1) * PAGE_SIZE,
  };
}

/** Scope of the Malva listing: the text language and the active vehicle's range keys. No store, market, branch or channel. */
export interface MalvaSearchContext {
  locale: string;
  fitKeys: string[] | null;
}
/** Like `SearchRequest`, but `query` is absent when nothing narrows the whole catalog (the API allows a request without a query). */
export type MalvaSearchRequest = Omit<SearchRequest, 'query'> & { query?: SearchExpression };

/**
 * The Malva listing query: the whole master catalog (no `stores` clause) and nothing about price or stock. A price sort falls
 * back to `popular` and the pickup filter is off, so no `variants.prices` or availability field can enter the request.
 */
export function buildMalvaSearchRequest(ctx: MalvaSearchContext, scope: ListingScope, p: ListingParams): MalvaSearchRequest {
  const and = scopeClauses(ctx, scope, p);
  const sort = p.sort === 'price-asc' || p.sort === 'price-desc' ? 'popular' : p.sort;
  const params: ListingParams = { ...p, sort, pickup: false };
  // No store, market or channel: the unused fields stay empty (price sorts and pickup are the only readers, and both are off).
  const open: SearchContext = { ...ctx, storeId: '', currency: '', country: '', branchChannelId: undefined, retailChannelId: undefined };
  return {
    query: and.length > 0 ? { and } : undefined,
    postFilter: postFilterFor(open, params),
    facets: FACETS.map((f) => ({ distinct: { name: f.name, field: f.field, fieldType: f.fieldType, limit: 50 } })),
    sort: sortFor(open, params),
    limit: PAGE_SIZE,
    offset: (p.page - 1) * PAGE_SIZE,
  };
}

/**
 * The exact part or OE number match of the store's assortment. It ignores the fit scope (Q-L02) but still honours the chosen
 * brand, part and pickup filters when `p` is given; null unless `q` looks like a number.
 */
export function buildExactPartRequest(ctx: SearchContext, q: string, p?: ListingParams): SearchRequest | null {
  const value = q.trim();
  if (!isPartNumberLike(value)) return null;
  return {
    query: { and: [exact('stores', ctx.storeId), { or: partNumberClauses(value) }] },
    postFilter: p ? postFilterFor(ctx, p) : undefined,
    limit: EXACT_LIMIT,
    offset: 0,
  };
}
