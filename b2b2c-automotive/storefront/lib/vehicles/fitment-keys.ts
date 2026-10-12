// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Fitment range keys: `make|model|year-from|year-to|engine` (years inclusive), the seed's `fitment-keys` text values.
// Pure, safe in client code. Used by J, K, L and M.
import type { FitmentRange } from '@/lib/types';

const YEAR = /^\d{4}$/;

/** Five `|` separated parts, integer years with from <= to, non-empty text; otherwise null. */
export function parseFitmentKey(key: string): FitmentRange | null {
  const parts = key.split('|');
  if (parts.length !== 5) return null;
  const [make, model, from, to, engine] = parts;
  if (!make || !model || !engine || !YEAR.test(from) || !YEAR.test(to)) return null;
  const yearFrom = Number(from);
  const yearTo = Number(to);
  if (yearFrom > yearTo) return null;
  return { make, model, yearFrom, yearTo, engine };
}

/** Same make, model and engine (exact, case-sensitive as seeded) and yearFrom <= year <= yearTo. */
export function vehicleInRange(vehicle: { make: string; model: string; year: number; engine: string }, range: FitmentRange): boolean {
  return (
    vehicle.make === range.make &&
    vehicle.model === range.model &&
    vehicle.engine === range.engine &&
    vehicle.year >= range.yearFrom &&
    vehicle.year <= range.yearTo
  );
}

export interface DisplayRange {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engines: string[];
}

/** For the compatible-vehicle list: keys with the same make, model and years are merged, engines sorted. Unparseable keys are skipped. */
export function groupRangesForDisplay(keys: string[]): DisplayRange[] {
  const groups = new Map<string, DisplayRange>();
  for (const key of keys) {
    const range = parseFitmentKey(key);
    if (!range) continue;
    const id = `${range.make}|${range.model}|${range.yearFrom}|${range.yearTo}`;
    const group = groups.get(id) ?? { make: range.make, model: range.model, yearFrom: range.yearFrom, yearTo: range.yearTo, engines: [] };
    if (!group.engines.includes(range.engine)) group.engines.push(range.engine);
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, engines: [...g.engines].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.yearFrom - b.yearFrom || a.yearTo - b.yearTo);
}
