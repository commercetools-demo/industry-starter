// URL contract of the listing (workstream G, 3.2). Pure: no server imports.
import { FACETS, FACET_BY_NAME, facetMode, isFacetValueAllowed } from '@/lib/search/facet-config';

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'relevance';
export type ListingScope = 'category' | 'shop' | 'search';

export interface ListingParams {
  q?: string;
  sort: SortKey;
  /** True when the URL carried a valid `sort` (so the default is not echoed back). */
  sortGiven: boolean;
  page: number;
  avail: boolean;
  facets: Record<string, string[]>;
}

export const MAX_PAGE = 400;
export const MAX_QUERY = 100;
const SORTS: SortKey[] = ['featured', 'price-asc', 'price-desc', 'rating', 'relevance'];

export function defaultSort(scope: ListingScope, hasQuery: boolean): SortKey {
  return scope === 'search' || hasQuery ? 'relevance' : 'featured';
}

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parseListingParams(sp: SP, scope: ListingScope): ListingParams {
  const rawQ = first(sp.q)?.trim().slice(0, MAX_QUERY);
  const q = rawQ ? rawQ : undefined;
  const sortRaw = first(sp.sort);
  const allowed = scope === 'search' || q ? SORTS : SORTS.filter((s) => s !== 'relevance');
  const sortGiven = sortRaw !== undefined && (allowed as string[]).includes(sortRaw);
  const sort = sortGiven ? (sortRaw as SortKey) : defaultSort(scope, Boolean(q));
  const pageNum = Number.parseInt(first(sp.page) ?? '', 10);
  const page = Number.isFinite(pageNum) ? Math.min(MAX_PAGE, Math.max(1, pageNum)) : 1;
  const facets: Record<string, string[]> = {};
  for (const def of FACETS) {
    const raw = first(sp[`f_${def.name}`]);
    if (!raw) continue;
    let values = [...new Set(raw.split(',').map((v) => v.trim()).filter((v) => isFacetValueAllowed(def, v)))];
    if (facetMode(def) === 'single') values = values.slice(0, 1);
    if (values.length > 0) facets[def.name] = values;
  }
  return { ...(q ? { q } : {}), sort, sortGiven, page, avail: first(sp.avail) === '1', facets };
}

/** Stable alphabetical order, defaults omitted. */
export function serializeListingParams(p: ListingParams, scope: ListingScope): URLSearchParams {
  const entries: [string, string][] = [];
  if (p.q) entries.push(['q', p.q]);
  if (p.sort !== defaultSort(scope, Boolean(p.q))) entries.push(['sort', p.sort]);
  if (p.page > 1) entries.push(['page', String(p.page)]);
  if (p.avail) entries.push(['avail', '1']);
  for (const [name, values] of Object.entries(p.facets)) {
    if (FACET_BY_NAME[name] && values.length > 0) entries.push([`f_${name}`, values.join(',')]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return new URLSearchParams(entries);
}

export function removeFilter(p: ListingParams, facet: string, value?: string): ListingParams {
  const facets = { ...p.facets };
  if (value === undefined) delete facets[facet];
  else {
    const rest = (facets[facet] ?? []).filter((v) => v !== value);
    if (rest.length > 0) facets[facet] = rest;
    else delete facets[facet];
  }
  return { ...p, facets, page: 1 };
}

export function toggleFacetValue(p: ListingParams, facet: string, value: string, mode: 'multi' | 'single'): ListingParams {
  const current = p.facets[facet] ?? [];
  const has = current.includes(value);
  const facets = { ...p.facets };
  const next = has ? current.filter((v) => v !== value) : mode === 'single' ? [value] : [...current, value];
  if (next.length > 0) facets[facet] = next;
  else delete facets[facet];
  return { ...p, facets, page: 1 };
}

export function clearAllFilters(p: ListingParams, scope: ListingScope): ListingParams {
  return { ...p, facets: {}, avail: false, page: 1, sort: defaultSort(scope, Boolean(p.q)), sortGiven: false };
}

export function activeFilterCount(p: ListingParams): number {
  return Object.values(p.facets).reduce((n, v) => n + v.length, 0) + (p.avail ? 1 : 0);
}

/** `path?query` for a locale-aware Link (path without the locale prefix). */
export function listingHref(path: string, p: ListingParams, scope: ListingScope): string {
  const qs = serializeListingParams(p, scope).toString();
  return qs ? `${path}?${qs}` : path;
}
