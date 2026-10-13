// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure filtering, ordering and link building of the Malva reseller finder (change add-malva-home). No network; safe in the browser.
import { distanceKm, type LatLng } from '@/lib/geo/distance';
import type { Reseller } from '@/lib/malva-types';
import { normalise } from '@/lib/store/branch-search';

/** Store keys and product slugs are checked before they enter an address (they come from a public API payload). */
export const STORE_KEY = /^[A-Za-z0-9_-]{2,256}$/;
export const PRODUCT_SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;

/** `/{store}` or `/{store}/p/{slug}` (without locale; the locale aware `Link` adds it). Null when the key or the slug is not valid. */
export function resellerPath(storeKey: string, productSlug?: string): string | null {
  if (!STORE_KEY.test(storeKey)) return null;
  if (productSlug === undefined) return `/${storeKey}`;
  return PRODUCT_SLUG.test(productSlug) ? `/${storeKey}/p/${productSlug}` : null;
}

/** Postal code prefix of the reseller, or a city (reseller or branch) containing the query; case and accents ignored. */
export function matchesReseller(reseller: Reseller, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  if (normalise(reseller.postalCode).startsWith(q) || normalise(reseller.city).includes(q)) return true;
  return reseller.branches.some((b) => normalise(b.city).includes(q));
}

export interface ResellerRow {
  reseller: Reseller;
  distanceKm?: number;
}

const point = (r: Reseller): LatLng | null => (r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : null);

/**
 * Rows of the list. The text filter narrows the list; when it matches nothing but the typed place was located (`geocoded`), every
 * reseller stays, nearest first. With an origin the rows are ordered by distance, otherwise by name.
 */
export function arrangeResellers(resellers: Reseller[], opts: { query: string; origin: LatLng | null; geocoded: boolean }): ResellerRow[] {
  const matched = resellers.filter((r) => matchesReseller(r, opts.query));
  const base = matched.length === 0 && opts.geocoded ? resellers : matched;
  const rows = base.map<ResellerRow>((reseller) => {
    const p = point(reseller);
    return { reseller, distanceKm: opts.origin && p ? distanceKm(opts.origin, p) : undefined };
  });
  const byName = (a: ResellerRow, b: ResellerRow) => a.reseller.name.localeCompare(b.reseller.name);
  return rows.sort((a, b) => {
    if (opts.origin && a.distanceKm !== undefined && b.distanceKm !== undefined && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    if (opts.origin && (a.distanceKm === undefined) !== (b.distanceKm === undefined)) return a.distanceKm === undefined ? 1 : -1;
    return byName(a, b);
  });
}
