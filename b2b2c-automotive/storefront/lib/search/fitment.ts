// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Fitment for listings, search and product pages (workstream J; used by K, L and M).
//
// How ranges are queried: Product Search cannot answer "year between from and to" over a text attribute, so the range is resolved on the
// VEHICLE side (`expandVehicleToKeys` over the small vehicle table, returned by `getActiveVehicle().fitKeys`) and matched on the PART side
// by exact range key. The expression goes into `query` (not `postFilter`) so facet counts reflect fit.
//   const vehicle = await getActiveVehicle();                       // lib/vehicles/active.ts (server only)
//   const mode = resolveFitMode(vehicle, searchParams.fit);          // fit=0 -> 'all'
//   const scope = fitScope(vehicle?.fitKeys ?? null, mode);          // SearchQuery | null, AND it into the query
//   getFitState({ fitmentKeys, universalFit }, vehicle)              // per card / PDP, pure
// Local (reseller owned) parts carry no `fitment-keys`: they never match fit-only and read "does-not-fit" with a vehicle.
import { parseFitmentKey, vehicleInRange } from '@/lib/vehicles/fitment-keys';
import type { FitmentProduct } from '@/lib/types';

export const FITMENT_KEYS_FIELD = 'variants.attributes.fitment-keys';
export const UNIVERSAL_FIT_FIELD = 'variants.attributes.universal-fit';

/** The slice of the commercetools SearchQuery this module builds (structurally compatible with the SDK type, which stays in lib/ct). */
export interface FitExactExpression {
  exact: { field: string; fieldType: 'set_text' | 'boolean'; values?: string[]; value?: boolean };
}
export interface FitQuery {
  or: FitExactExpression[];
}
export type FitMode = 'fit-only' | 'all';
export type FitState = 'fits' | 'does-not-fit' | 'unknown';

const universalBranch: FitExactExpression = { exact: { field: UNIVERSAL_FIT_FIELD, fieldType: 'boolean', value: true } };

/** Exact match on any expanded key, or universal. Empty `keys` (vehicle not in the table) leaves only the universal branch. */
export function fitExpression(keys: string[]): FitQuery {
  const branches: FitExactExpression[] = [];
  if (keys.length) branches.push({ exact: { field: FITMENT_KEYS_FIELD, fieldType: 'set_text', values: keys } });
  branches.push(universalBranch);
  return { or: branches };
}

/** No vehicle -> no expression. Vehicle + fit-only -> `fitExpression(keys)`. Vehicle + all -> no expression (fit is shown per card). */
export function fitScope(keys: string[] | null, mode: FitMode): FitQuery | null {
  if (keys === null || mode === 'all') return null;
  return fitExpression(keys);
}

/** `fit=0` turns the filter off; otherwise fit-only when a vehicle is active. */
export function resolveFitMode(vehicle: unknown | null, fitParam: string | undefined): FitMode {
  if (fitParam === '0') return 'all';
  return vehicle ? 'fit-only' : 'all';
}

/** Pure; reads the mapped product (range keys) and never calls commercetools. `unknown` without a vehicle. */
export function getFitState(product: FitmentProduct, vehicle: { make: string; model: string; year: number; engine: string } | null): FitState {
  if (!vehicle) return 'unknown';
  if (product.universalFit) return 'fits';
  const fits = product.fitmentKeys.some((key) => {
    const range = parseFitmentKey(key);
    return range !== null && vehicleInRange(vehicle, range);
  });
  return fits ? 'fits' : 'does-not-fit';
}
