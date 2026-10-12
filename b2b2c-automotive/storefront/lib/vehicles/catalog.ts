// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The vehicle table as pure functions over its records (custom object container `mau-vehicles`, read in lib/ct/vehicles.ts).
// The dependent selectors are derived from the year ranges; fit never reads this table for the part side.
import type { Vehicle, VehicleId, VehicleRecord } from '@/lib/types';
import { buildVehicleId, parseVehicleId, slugPart } from './id';

export interface CatalogOption {
  /** Slug used in URLs and ids. */
  key: string;
  label: string;
}
export interface EngineOption extends CatalogOption {
  /** The id of the vehicle with the chosen year and this engine. */
  vehicleId: VehicleId;
}

/** "2016 Volkswagen Golf · 2.0 TDI" */
export function vehicleLabel(v: { make: string; model: string; year: number; engine: string }): string {
  return `${v.year} ${v.make} ${v.model} · ${v.engine}`;
}

const byLabel = (a: CatalogOption, b: CatalogOption) => a.label.localeCompare(b.label, 'en', { numeric: true });

function unique(options: CatalogOption[]): CatalogOption[] {
  const seen = new Map<string, CatalogOption>();
  for (const o of options) if (!seen.has(o.key)) seen.set(o.key, o);
  return [...seen.values()].sort(byLabel);
}

export interface Catalog {
  makes(): CatalogOption[];
  /** `null` when the make is not in the catalog. */
  models(make: string): CatalogOption[] | null;
  /** Every year from `yearFrom` to `yearTo` of any record of the make and model, descending; `null` when unknown. */
  years(make: string, model: string): number[] | null;
  /** Engines of the records whose range contains the year, once each; `null` when the year is not offered. */
  engines(make: string, model: string, year: number): EngineOption[] | null;
}

/** `market` limits the records to those sold in that market (`DE` or `US`); without it every record counts. */
export function buildCatalog(records: VehicleRecord[], market?: string): Catalog {
  const inMarket = market ? records.filter((r) => r.markets.includes(market)) : records;
  const forMake = (make: string) => inMarket.filter((r) => slugPart(r.make) === make);
  const forModel = (make: string, model: string) => forMake(make).filter((r) => slugPart(r.model) === model);
  return {
    makes: () => unique(inMarket.map((r) => ({ key: slugPart(r.make), label: r.make }))),
    models(make) {
      const rows = forMake(make);
      return rows.length ? unique(rows.map((r) => ({ key: slugPart(r.model), label: r.model }))) : null;
    },
    years(make, model) {
      const rows = forModel(make, model);
      if (!rows.length) return null;
      const years = new Set<number>();
      for (const r of rows) for (let y = r.yearFrom; y <= r.yearTo; y += 1) years.add(y);
      return [...years].sort((a, b) => b - a);
    },
    engines(make, model, year) {
      const rows = forModel(make, model).filter((r) => year >= r.yearFrom && year <= r.yearTo);
      if (!rows.length) return null;
      return unique(rows.map((r) => ({ key: slugPart(r.engine), label: r.engine }))).map((o) => ({
        ...o,
        vehicleId: buildVehicleId({ make, model, year, engine: o.key }),
      }));
    },
  };
}

/** Records with the same slugs whose range contains the year. */
function recordsFor(records: VehicleRecord[], p: { make: string; model: string; year: number; engine: string }): VehicleRecord[] {
  return records.filter(
    (r) =>
      slugPart(r.make) === slugPart(p.make) &&
      slugPart(r.model) === slugPart(p.model) &&
      slugPart(r.engine) === slugPart(p.engine) &&
      p.year >= r.yearFrom &&
      p.year <= r.yearTo,
  );
}

/** The vehicle of an id, spelled as in the table, or null when no record covers it (unknown make, model, engine, or year outside every range). */
export function vehicleFromId(records: VehicleRecord[], id: VehicleId): Vehicle | null {
  const parts = parseVehicleId(id);
  if (!parts) return null;
  const record = recordsFor(records, parts)[0];
  if (!record) return null;
  const vehicle = { make: record.make, model: record.model, year: parts.year, engine: record.engine };
  return { id: buildVehicleId(vehicle), ...vehicle, label: vehicleLabel(vehicle) };
}

/**
 * The range keys a vehicle fits: the `fitmentKey` of every record with the same make, model and engine (exact) whose range contains the year.
 * Usually one key, two where generations overlap (Golf VII and VIII in 2019); empty when the table does not cover the vehicle.
 */
export function expandVehicleToKeys(vehicle: { make: string; model: string; year: number; engine: string }, records: VehicleRecord[]): string[] {
  const keys = records
    .filter((r) => r.make === vehicle.make && r.model === vehicle.model && r.engine === vehicle.engine && vehicle.year >= r.yearFrom && vehicle.year <= r.yearTo)
    .map((r) => r.fitmentKey);
  return [...new Set(keys)];
}

/** The `fitmentKey` of a garage entry: the stored one when it is still a matching record, else the first matching record; null when none. */
export function findFitmentKeyFor(
  records: VehicleRecord[],
  entry: { make: string; model: string; year: number; engine: string; fitmentKey?: string },
): string | null {
  const matches = recordsFor(records, entry);
  if (!matches.length) return null;
  return matches.find((r) => r.fitmentKey === entry.fitmentKey)?.fitmentKey ?? matches[0].fitmentKey;
}
