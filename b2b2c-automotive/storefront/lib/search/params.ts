// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Listing parameters held in the address (workstream L): `q`, `sort`, `page`, `fit=0`, `brand` (repeatable), `pickup=1`,
// `attr.<name>` (repeatable, any configured attribute facet). The address never carries the vehicle (D5).
// Pure: no server-only, used by Server Components, client components and tests.

export const SORT_KEYS = ['popular', 'price-asc', 'price-desc', 'rated'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const PAGE_SIZE = 24;
/** Product Search allows `offset + limit` up to 10000. */
export const MAX_PAGE = 400;
const MAX_QUERY_LENGTH = 100;
const MAX_VALUES = 20;
const MAX_ATTRS = 8;

export interface ListingParams {
  q?: string;
  sort: SortKey;
  /** True when the address carried a valid `sort`; a search without it is ordered by relevance (`effectiveSort`). */
  sortGiven: boolean;
  page: number;
  /** False only when the address has `fit=0`. Without an active vehicle the flag has no effect. */
  fit: boolean;
  brand: string[];
  pickup: boolean;
  /** Part specific facets by attribute name, for example `{ position: ['front'] }`. */
  attrs: Record<string, string[]>;
}

type RawParams = Record<string, string | string[] | undefined>;

const VALUE = /^[A-Za-z0-9_-]{1,64}$/;
const ATTR_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ATTR_PREFIX = 'attr.';

const all = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const values = (v: string | string[] | undefined): string[] =>
  [...new Set(all(v).filter((x) => VALUE.test(x)))].sort().slice(0, MAX_VALUES);

export function parseListingParams(sp: RawParams): ListingParams {
  const rawSort = all(sp.sort)[0];
  const sortGiven = SORT_KEYS.includes(rawSort as SortKey);
  const pageNumber = Number(all(sp.page)[0]);
  const q = all(sp.q)[0]?.trim().slice(0, MAX_QUERY_LENGTH).trim();
  const attrs: Record<string, string[]> = {};
  for (const key of Object.keys(sp).sort()) {
    if (!key.startsWith(ATTR_PREFIX) || Object.keys(attrs).length >= MAX_ATTRS) continue;
    const name = key.slice(ATTR_PREFIX.length);
    const list = values(sp[key]);
    if (ATTR_NAME.test(name) && list.length > 0) attrs[name] = list;
  }
  return {
    q: q ? q : undefined,
    sort: sortGiven ? (rawSort as SortKey) : 'popular',
    sortGiven,
    page: Number.isInteger(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, MAX_PAGE) : 1,
    fit: all(sp.fit)[0] !== '0',
    brand: values(sp.brand),
    pickup: all(sp.pickup)[0] === '1',
    attrs,
  };
}

/** The order that applies: a search without an explicit sort is ordered by relevance. */
export function effectiveSort(p: Pick<ListingParams, 'q' | 'sort' | 'sortGiven'>): SortKey | 'relevance' {
  if (p.q && !p.sortGiven) return 'relevance';
  return p.sort;
}

/** Stable query string: keys sorted, defaults omitted (`defaults` can override the default sort of a surface). */
export function serializeListingParams(p: ListingParams, defaults: Partial<ListingParams> = {}): URLSearchParams {
  const out: [string, string][] = [];
  if (p.q) out.push(['q', p.q]);
  const defaultSort = defaults.sort ?? 'popular';
  // On a search the default is relevance, so an explicit sort is always written; on a listing only when it differs.
  if (p.q ? p.sortGiven : p.sort !== defaultSort) out.push(['sort', p.sort]);
  if (p.page > 1) out.push(['page', String(p.page)]);
  if (!p.fit) out.push(['fit', '0']);
  for (const b of [...p.brand].sort()) out.push(['brand', b]);
  if (p.pickup) out.push(['pickup', '1']);
  for (const name of Object.keys(p.attrs).sort()) for (const v of [...p.attrs[name]].sort()) out.push([`${ATTR_PREFIX}${name}`, v]);
  out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return new URLSearchParams(out);
}

/** The address of `params` on a surface: `basePath` (without locale) plus the stable query string. */
export function listingHref(basePath: string, p: ListingParams): string {
  const qs = serializeListingParams(p).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export type FilterKey = 'brand' | 'pickup' | 'fit' | `attr:${string}`;

/** Removes one filter (or one value of a multi value filter); the page goes back to 1 because the result set changes. */
export function removeFilter(p: ListingParams, key: FilterKey, value?: string): ListingParams {
  const next: ListingParams = { ...p, page: 1, brand: [...p.brand], attrs: { ...p.attrs } };
  if (key === 'brand') next.brand = value === undefined ? [] : p.brand.filter((b) => b !== value);
  else if (key === 'pickup') next.pickup = false;
  else if (key === 'fit') next.fit = true;
  else {
    const name = key.slice('attr:'.length);
    const rest = value === undefined ? [] : (p.attrs[name] ?? []).filter((v) => v !== value);
    if (rest.length > 0) next.attrs[name] = rest;
    else delete next.attrs[name];
  }
  return next;
}

/** Keeps `q` (and the sort); drops every filter and the page. Used by "Clear all". */
export function clearFilters(p: ListingParams): ListingParams {
  return { ...p, page: 1, fit: true, brand: [], pickup: false, attrs: {} };
}

/** Brand, pickup and part facets. The fit switch is not counted: it is a personal view, shown by the garage controls. */
export function hasActiveFilters(p: ListingParams): boolean {
  return p.pickup || p.brand.length > 0 || Object.keys(p.attrs).length > 0;
}
