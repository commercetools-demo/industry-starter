import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from '@/lib/config/search';
import type { SearchSort } from '@/lib/types';

// URL contract of the search page: /search?q=<text>&category=<categoryKey>&sort=<sortId>&page=<n>. Pure (client and server).

export interface SearchParams {
  /** Normalised query text (may be shorter than MIN_QUERY_LENGTH: the start state). */
  q: string;
  /** Category key of the offer's primary category, or null. */
  category: string | null;
  sort: SearchSort;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Trim, collapse whitespace, cut at MAX_QUERY_LENGTH. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH).trim();
}

/** A pasted identifier: no spaces, at least 4 characters, letters, digits, dot, underscore and hyphen. */
export function looksLikeSku(raw: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{3,}$/.test(normalizeQuery(raw));
}

export const isSearchableQuery = (q: string): boolean => q.length >= MIN_QUERY_LENGTH;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Unknown categories, sorts and pages are ignored (never an error). */
export function parseSearchParams(raw: RawSearchParams, validCategoryKeys: readonly string[]): SearchParams {
  const category = first(raw.category);
  const sort = first(raw.sort);
  const pageText = first(raw.page);
  const page = pageText !== undefined && /^\d{1,6}$/.test(pageText) ? Number(pageText) : 1;
  return {
    q: normalizeQuery(first(raw.q) ?? ''),
    category: category !== undefined && validCategoryKeys.includes(category) ? category : null,
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'relevance',
    page: Math.max(1, page),
  };
}

/** Defaults are omitted. */
export function toSearchQueryString(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.q !== '') search.set('q', params.q);
  if (params.category !== null) search.set('category', params.category);
  if (params.sort !== 'relevance') search.set('sort', params.sort);
  if (params.page > 1) search.set('page', String(params.page));
  const text = search.toString();
  return text === '' ? '' : `?${text}`;
}

/** Changing q, category or sort goes back to page 1; an explicit `page` in the change wins. */
export function withSearchChange(params: SearchParams, change: Partial<SearchParams>): SearchParams {
  return { ...params, page: 1, ...change };
}
