// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CustomObject } from '@commercetools/platform-sdk';
import type { VehicleRecord } from '@/lib/types';
import { parseFitmentKey } from '@/lib/vehicles/fitment-keys';

const MARKETS = new Set(['DE', 'US']);

/**
 * One object of the vehicle table (container `mau-vehicles`). `null` when a field is missing, the years are inconsistent, or the stored
 * `fitmentKey` is not the key of this record (the join to the parts must be exact).
 */
export function mapVehicleRecord(object: CustomObject): VehicleRecord | null {
  const v = object.value as Record<string, unknown> | null;
  if (typeof v !== 'object' || v === null) return null;
  const { make, model, engine, fitmentKey, yearFrom, yearTo } = v;
  if (typeof make !== 'string' || typeof model !== 'string' || typeof engine !== 'string' || typeof fitmentKey !== 'string') return null;
  if (typeof yearFrom !== 'number' || typeof yearTo !== 'number' || yearFrom > yearTo) return null;
  const range = parseFitmentKey(fitmentKey);
  if (!range || range.make !== make || range.model !== model || range.engine !== engine || range.yearFrom !== yearFrom || range.yearTo !== yearTo) return null;
  const markets = Array.isArray(v.markets) ? v.markets.filter((m): m is string => typeof m === 'string' && MARKETS.has(m)) : [];
  return { make, model, generation: typeof v.generation === 'string' ? v.generation : '', yearFrom, yearTo, engine, markets, fitmentKey };
}
