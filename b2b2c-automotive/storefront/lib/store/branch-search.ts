// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure filtering and ordering of the picker list. No network: the text filter works with the geocoder down.
import { distanceKm, type LatLng } from '@/lib/geo/distance';
import type { BranchView } from '@/lib/types';

export interface BranchRowData {
  branch: BranchView;
  /** Kilometres from `origin` when an origin is known and the branch has coordinates. */
  distanceKm?: number;
}

/** Lower case, accents removed ("München" and "munchen" match). */
export const normalise = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

/** Postal code prefix, or city / branch name contains, case-insensitive. An empty query matches everything. */
export function matchesQuery(branch: BranchView, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return normalise(branch.address.postalCode).startsWith(q) || normalise(branch.address.city).includes(q) || normalise(branch.name).includes(q);
}

/**
 * Rows for the list. While the text filter is the only signal it narrows the list; once the geocoder located the query
 * (`geocoded`), every branch stays and they are ordered by distance from the searched place. Sorted by distance from the
 * origin when one is known, else alphabetically by name.
 */
export function arrangeBranches(branches: BranchView[], opts: { query: string; origin: LatLng | null; geocoded: boolean }): BranchRowData[] {
  const base = opts.geocoded ? branches : branches.filter((b) => matchesQuery(b, opts.query));
  const rows = base.map<BranchRowData>((branch) => ({ branch, distanceKm: opts.origin && branch.geo ? distanceKm(opts.origin, branch.geo) : undefined }));
  const byName = (a: BranchRowData, b: BranchRowData) => a.branch.name.localeCompare(b.branch.name);
  return rows.sort((a, b) => {
    if (opts.origin && a.distanceKm !== undefined && b.distanceKm !== undefined && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    if (opts.origin && (a.distanceKm === undefined) !== (b.distanceKm === undefined)) return a.distanceKm === undefined ? 1 : -1;
    return byName(a, b);
  });
}
