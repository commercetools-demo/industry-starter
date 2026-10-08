/**
 * Doctor list state <-> URL (`?q=&specialty=&city=&today=1&page=`). Pure and deterministic: the same URL is the
 * same listing (product-listing-page). Unknown or malformed values are dropped, never trusted.
 */
export interface ListingState {
  q: string;
  specialty: string;
  city: string;
  today: boolean;
  page: number;
}

export const EMPTY_LISTING: ListingState = { q: '', specialty: '', city: '', today: false, page: 1 };
export const MAX_QUERY_LENGTH = 80;
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

type Raw = string | string[] | undefined;
type RawParams = Record<string, Raw> | URLSearchParams;

function first(params: RawParams, name: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(name) ?? undefined;
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Collapses whitespace, drops control characters and caps the length. */
export function cleanQuery(value: string | undefined): string {
  // eslint-disable-next-line no-control-regex
  return (value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

export function parseListingState(params: RawParams): ListingState {
  const key = (name: string) => {
    const v = (first(params, name) ?? '').trim().toLowerCase();
    return KEY_PATTERN.test(v) ? v : '';
  };
  const today = first(params, 'today');
  return {
    q: cleanQuery(first(params, 'q')),
    specialty: key('specialty'),
    city: key('city'),
    today: today === '1' || today === 'true',
    page: parsePage(first(params, 'page')),
  };
}

/** Query string without the leading `?`; defaults are omitted so equal states give equal strings. */
export function serializeListingState(state: Partial<ListingState>): string {
  const out = new URLSearchParams();
  const q = cleanQuery(state.q);
  if (q) out.set('q', q);
  if (state.specialty) out.set('specialty', state.specialty);
  if (state.city) out.set('city', state.city);
  if (state.today) out.set('today', '1');
  if (state.page && state.page > 1) out.set('page', String(state.page));
  return out.toString();
}

export function listingHref(path: string, state: Partial<ListingState>): string {
  const query = serializeListingState(state);
  return query ? `${path}?${query}` : path;
}

export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** A page past the last result gives the last page that has results (page 1 for an empty list). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCountOf(total, pageSize));
}

/** The city only counts in office mode. */
export function hasActiveFilters(state: ListingState, mode: 'remote' | 'office' = 'office'): boolean {
  return Boolean(state.q || state.specialty || (mode === 'office' && state.city) || state.today);
}
