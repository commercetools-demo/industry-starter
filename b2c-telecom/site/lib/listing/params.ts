import type { ListingParams, ListingSort } from '@/lib/types';

export const DEFAULT_SORT: ListingSort = 'price-asc';
const SORTS: readonly ListingSort[] = ['price-asc', 'price-desc'];

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Reads the listing state from the query string. Anything invalid falls back to the default: an unknown chip, a sort that is not
 * listed, a page that is not a positive integer. `validChips` are the chip ids of the listing (H's `chipsFor`).
 */
export function parseListingParams(raw: RawParams, validChips: readonly string[]): ListingParams {
  const filter = first(raw.filter);
  const sort = first(raw.sort);
  const page = first(raw.page);
  const offer = first(raw.offer);
  const pageNumber = page !== undefined && /^\d+$/.test(page) ? Number.parseInt(page, 10) : 1;
  return {
    filter: filter !== undefined && filter !== 'all' && validChips.includes(filter) ? filter : null,
    sort: SORTS.find((candidate) => candidate === sort) ?? DEFAULT_SORT,
    page: pageNumber >= 1 ? pageNumber : 1,
    offer: offer !== undefined && /^[a-z0-9-]{1,100}$/.test(offer) ? offer : null,
  };
}

/** `?filter=..&sort=..&page=..&offer=..` with every default left out; '' when nothing is left. */
export function toQueryString(params: ListingParams): string {
  const query = new URLSearchParams();
  if (params.filter) query.set('filter', params.filter);
  if (params.sort !== DEFAULT_SORT) query.set('sort', params.sort);
  if (params.page > 1) query.set('page', String(params.page));
  if (params.offer) query.set('offer', params.offer);
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/**
 * The state after a change. A new filter or sort starts at page 1; any change drops the `offer` anchor (it is a one-time pointer,
 * not a filter) unless the patch sets it.
 */
export function withListingChange(current: ListingParams, patch: Partial<ListingParams>): ListingParams {
  const next: ListingParams = { ...current, ...patch };
  const resets = 'filter' in patch || 'sort' in patch;
  if (resets && !('page' in patch)) next.page = 1;
  if (!('offer' in patch)) next.offer = null;
  return next;
}
