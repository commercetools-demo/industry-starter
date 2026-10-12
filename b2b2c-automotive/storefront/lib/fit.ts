// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Cart level fit (workstream N-12). Wraps `getFitState` of J (range based: the part's `fitment-keys` and `universal-fit` against the active
// vehicle's make, model, year and engine); no fit rule is duplicated. The cart only WARNS: nothing here blocks a line or Checkout (D12).
import { getFitState } from '@/lib/search/fitment';
import type { CartFit, CartLine } from '@/lib/types';

type VehicleLike = { make: string; model: string; year: number; engine: string };

/** Fit of each line by line id. Without a vehicle every line is `unknown` and there is no warning. */
export function getLineFit(lines: Pick<CartLine, 'id' | 'fitment'>[], vehicle: VehicleLike | null): Record<string, CartFit> {
  return Object.fromEntries(lines.map((line) => [line.id, getFitState(line.fitment, vehicle)]));
}

/** Number of lines that do not fit the vehicle (the banner count). */
export function countMisfits(fits: Record<string, CartFit>): number {
  return Object.values(fits).filter((fit) => fit === 'does-not-fit').length;
}
