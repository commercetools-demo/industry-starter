import { haversineKm, type LatLng } from '@/lib/geo';
import { NEARBY_RADIUS_KM } from '@/lib/shop-config';
import type { Store } from '@/lib/types';

/** Lower case, accents removed, trimmed. */
export function normalise(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const compact = (text: string) => normalise(text).replace(/\s+/g, '');

/** A store matches when its postcode starts with the typed text (spaces ignored) or its city or name contains it. */
export function matchesQuery(store: Store, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return (
    compact(store.postalCode).startsWith(compact(query)) ||
    normalise(store.city).includes(q) ||
    normalise(store.name).includes(q)
  );
}

export interface RankedStore { store: Store; km: number | null }

export interface StoreSearchResult {
  rows: RankedStore[];
  /** The list is empty because nothing matched or everything is too far (the "No match" state). */
  noMatch: boolean;
  /** Distances are real: they are measured from the shopper's position. */
  hasDistance: boolean;
}

const byCityThenName = (a: Store, b: Store) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name);

/**
 * Client-side store search (Q-F-01, Q-F-14), no geocoder.
 *  - Typed text narrows the list to matching stores.
 *  - With the shopper's position (opt-in browser geolocation) rows are sorted by distance and show it; a position farther
 *    than NEARBY_RADIUS_KM from every store is "no match".
 *  - Without a position no distance is ever shown (never a fake one). Matches are ordered by distance from the first
 *    match, so a postcode prefix lists the nearest stores together; with one match or none there is nothing to order.
 */
export function searchStores(stores: Store[], query: string, position: LatLng | null): StoreSearchResult {
  const matches = stores.filter((s) => matchesQuery(s, query)).sort(byCityThenName);

  if (position) {
    const rows = matches
      .map((store) => ({ store, km: store.geo ? haversineKm(position, store.geo) : null }))
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    const nearest = rows[0]?.km;
    if (nearest === undefined || nearest === null || nearest > NEARBY_RADIUS_KM) {
      return { rows: [], noMatch: true, hasDistance: true };
    }
    return { rows, noMatch: false, hasDistance: true };
  }

  if (matches.length === 0) return { rows: [], noMatch: query.trim() !== '', hasDistance: false };

  const origin = query.trim() !== '' ? matches[0].geo : undefined;
  const ordered = origin
    ? [...matches].sort((a, b) =>
        (a.geo ? haversineKm(origin, a.geo) : Infinity) - (b.geo ? haversineKm(origin, b.geo) : Infinity),
      )
    : matches;
  return { rows: ordered.map((store) => ({ store, km: null })), noMatch: false, hasDistance: false };
}
