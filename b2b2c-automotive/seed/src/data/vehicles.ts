// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { slugify } from './base';

/**
 * Vehicle table (custom object container `mau-vehicles`, one object per generation and engine).
 * SYNTHETIC demo data: makes and models are real names used nominatively, the compatibility claims are not.
 * `fitmentKey` is exactly the text value stored in the part attribute `fitment-keys`.
 */
export interface VehicleDef {
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  engines: string[];
  markets: ('DE' | 'US')[];
}

export const VEHICLE_DEFS: VehicleDef[] = [
  { make: 'Volkswagen', model: 'Golf', generation: 'VII', yearFrom: 2012, yearTo: 2019, engines: ['1.4 TSI', '2.0 TDI'], markets: ['DE'] },
  { make: 'Volkswagen', model: 'Golf', generation: 'VIII', yearFrom: 2019, yearTo: 2024, engines: ['1.5 TSI', '2.0 TDI'], markets: ['DE'] },
  { make: 'Audi', model: 'A3', generation: '8V', yearFrom: 2012, yearTo: 2020, engines: ['1.4 TFSI', '2.0 TDI'], markets: ['DE'] },
  { make: 'BMW', model: '3 Series', generation: 'F30', yearFrom: 2012, yearTo: 2019, engines: ['320d', '328i'], markets: ['DE', 'US'] },
  { make: 'Mercedes-Benz', model: 'C-Class', generation: 'W205', yearFrom: 2014, yearTo: 2021, engines: ['C 200', 'C 220 d'], markets: ['DE', 'US'] },
  { make: 'Opel', model: 'Astra', generation: 'K', yearFrom: 2015, yearTo: 2021, engines: ['1.4 Turbo', '1.6 CDTI'], markets: ['DE'] },
  { make: 'Ford', model: 'Focus', generation: 'Mk4', yearFrom: 2018, yearTo: 2025, engines: ['1.0 EcoBoost', '1.5 EcoBlue'], markets: ['DE'] },
  { make: 'Skoda', model: 'Octavia', generation: 'III', yearFrom: 2013, yearTo: 2020, engines: ['1.5 TSI', '2.0 TDI'], markets: ['DE'] },
  { make: 'Renault', model: 'Clio', generation: 'V', yearFrom: 2019, yearTo: 2025, engines: ['1.0 TCe', '1.5 dCi'], markets: ['DE'] },
  { make: 'Ford', model: 'F-150', generation: 'Thirteenth', yearFrom: 2015, yearTo: 2020, engines: ['3.5 EcoBoost', '5.0 V8'], markets: ['US'] },
  { make: 'Toyota', model: 'Camry', generation: 'XV70', yearFrom: 2018, yearTo: 2024, engines: ['2.5', '3.5 V6'], markets: ['US'] },
  { make: 'Toyota', model: 'Corolla', generation: 'E210', yearFrom: 2019, yearTo: 2025, engines: ['1.8 Hybrid', '2.0'], markets: ['DE', 'US'] },
  { make: 'Chevrolet', model: 'Silverado 1500', generation: 'Fourth', yearFrom: 2019, yearTo: 2024, engines: ['5.3 V8', '6.2 V8'], markets: ['US'] },
];

export interface VehicleRecord {
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  markets: string[];
  fitmentKey: string;
}

export const fitmentKey = (make: string, model: string, yearFrom: number, yearTo: number, engine: string): string =>
  `${make}|${model}|${yearFrom}|${yearTo}|${engine}`;

export const VEHICLES: VehicleRecord[] = VEHICLE_DEFS.flatMap((d) =>
  d.engines.map((engine) => ({
    make: d.make, model: d.model, generation: d.generation, yearFrom: d.yearFrom, yearTo: d.yearTo, engine, markets: d.markets,
    fitmentKey: fitmentKey(d.make, d.model, d.yearFrom, d.yearTo, engine),
  })),
);

/** Custom object key of a vehicle record. */
export const vehicleObjectKey = (v: VehicleRecord): string => `mau-veh-${slugify(`${v.make} ${v.model} ${v.generation} ${v.engine}`)}`;

/** Fitment keys for `make model` (all generations and engines, or only the listed engines / generations). */
export function fits(make: string, model: string, filter?: { engines?: string[]; generations?: string[] }): string[] {
  const out = VEHICLES.filter(
    (v) => v.make === make && v.model === model && (!filter?.engines || filter.engines.includes(v.engine)) && (!filter?.generations || filter.generations.includes(v.generation)),
  ).map((v) => v.fitmentKey);
  if (out.length === 0) throw new Error(`No vehicle for ${make} ${model} ${JSON.stringify(filter ?? {})}`);
  return out;
}

/** Fitment of a vehicle by make, model, year and engine (what the finder does after the shopper picks four selectors). */
export function findFitmentKey(make: string, model: string, year: number, engine: string): string | undefined {
  return VEHICLES.find((v) => v.make === make && v.model === model && v.engine === engine && year >= v.yearFrom && year <= v.yearTo)?.fitmentKey;
}
