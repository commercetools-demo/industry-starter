import type { SortKey } from './types';

/** URL contract of the listing: `/shop?category=<slug>&price=<bandId>&stock=in|out&sort=...&page=<n>`. */
export interface ListingParams {
  /** Category slug (resolved to an id by the page; an unknown slug is ignored there). */
  category?: string;
  /** Price band id (unknown ids are ignored by the search builder). */
  price?: string;
  stock?: 'in' | 'out';
  sort: SortKey;
  page: number;
}

export const DEFAULT_SORT: SortKey = 'relevance';
export const SORT_KEYS: readonly SortKey[] = ['relevance', 'newest', 'price-asc', 'price-desc'];

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;
const MAX_PAGE = 10_000;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Never throws: anything invalid falls back to the default (not an error page). */
export function parseListingParams(searchParams: RawSearchParams): ListingParams {
  const category = first(searchParams.category)?.trim();
  const price = first(searchParams.price)?.trim();
  const stock = first(searchParams.stock);
  const sort = first(searchParams.sort);
  const rawPage = first(searchParams.page);
  const page = rawPage !== undefined && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    ...(category && SLUG.test(category) ? { category } : {}),
    ...(price && /^[a-z0-9-]+$/.test(price) ? { price } : {}),
    ...(stock === 'in' || stock === 'out' ? { stock } : {}),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULT_SORT,
    page: page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** Query string without the leading `?`; defaults are omitted, so the default listing is `''`. */
export function toQueryString(params: Partial<ListingParams>): string {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.price) query.set('price', params.price);
  if (params.stock) query.set('stock', params.stock);
  if (params.sort && params.sort !== DEFAULT_SORT) query.set('sort', params.sort);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  return query.toString();
}

/** Applies a change; any filter or sort change resets `page` to 1, unless the patch sets the page itself. */
export function withListingChange(current: ListingParams, patch: Partial<ListingParams>): ListingParams {
  const next = { ...current, ...patch };
  for (const key of ['category', 'price', 'stock'] as const) {
    if (key in patch && patch[key] === undefined) delete next[key];
  }
  if (!('page' in patch)) next.page = 1;
  return next;
}

/** `/shop` or `/shop?...`, ready for the locale-aware router and links. */
export function listingHref(params: Partial<ListingParams>, basePath = '/shop'): string {
  const query = toQueryString(params);
  return query ? `${basePath}?${query}` : basePath;
}
