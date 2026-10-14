// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildCatalog, expandVehicleToKeys, findFitmentKeyFor, vehicleFromId, vehicleLabel } from './catalog';
import { VEHICLE_RECORDS } from './test-fixtures';

describe('Vehicle catalog (pure)', () => {
  const de = buildCatalog(VEHICLE_RECORDS, 'DE');

  it('lists makes of the market', () => {
    expect(de.makes().map((m) => m.key)).toContain('volkswagen');
    expect(de.makes().map((m) => m.key)).not.toContain('chevrolet');
    expect(buildCatalog(VEHICLE_RECORDS, 'US').makes().map((m) => m.key)).toContain('chevrolet');
  });

  it('markets filter the catalog', () => {
    const us = buildCatalog(VEHICLE_RECORDS, 'US');
    expect(us.models('toyota')?.map((m) => m.key)).toEqual(['camry', 'corolla']);
    expect(de.models('toyota')?.map((m) => m.key)).toEqual(['corolla']);
    expect(de.models('ford')?.map((m) => m.key)).toEqual(['focus']);
    expect(de.models('nope')).toBeNull();
  });

  it('years come from the ranges descending', () => {
    const years = de.years('volkswagen', 'golf');
    expect(years?.[0]).toBe(2024);
    expect(years?.[years.length - 1]).toBe(2012);
    expect(years).toHaveLength(13);
    expect(years).toEqual([...(years ?? [])].sort((a, b) => b - a));
    expect(de.years('volkswagen', 'polo')).toBeNull();
  });

  it('year 2019 offers the engines of both generations', () => {
    const engines = de.engines('volkswagen', 'golf', 2019);
    expect(engines?.map((e) => e.label)).toEqual(['1.4 TSI', '1.5 TSI', '2.0 TDI']);
    expect(engines?.map((e) => e.vehicleId)).toEqual(['volkswagen.golf.2019.1-4-tsi', 'volkswagen.golf.2019.1-5-tsi', 'volkswagen.golf.2019.2-0-tdi']);
  });

  it('engines depend on the year', () => {
    expect(de.engines('volkswagen', 'golf', 2016)?.map((e) => e.label)).toEqual(['1.4 TSI', '2.0 TDI']);
    expect(de.engines('volkswagen', 'golf', 2022)?.map((e) => e.label)).toEqual(['1.5 TSI', '2.0 TDI']);
    expect(de.engines('volkswagen', 'golf', 2030)).toBeNull();
  });

  it('label format', () => {
    expect(vehicleLabel({ make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' })).toBe('2016 Volkswagen Golf · 2.0 TDI');
  });

  it('builds a vehicle from an id with the table spelling', () => {
    expect(vehicleFromId(VEHICLE_RECORDS, 'volkswagen.golf.2016.2-0-tdi')).toEqual({
      id: 'volkswagen.golf.2016.2-0-tdi',
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      engine: '2.0 TDI',
      label: '2016 Volkswagen Golf · 2.0 TDI',
    });
  });

  it('unknown id returns null', () => {
    expect(vehicleFromId(VEHICLE_RECORDS, 'volkswagen.golf.2016.9-9-xyz')).toBeNull();
    expect(vehicleFromId(VEHICLE_RECORDS, 'not an id')).toBeNull();
  });

  it('year outside every range returns null', () => {
    expect(vehicleFromId(VEHICLE_RECORDS, 'volkswagen.golf.2011.2-0-tdi')).toBeNull();
    expect(vehicleFromId(VEHICLE_RECORDS, 'volkswagen.golf.2025.2-0-tdi')).toBeNull();
  });

  it('expand gives one key inside one generation', () => {
    expect(expandVehicleToKeys({ make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' }, VEHICLE_RECORDS)).toEqual([
      'Volkswagen|Golf|2012|2019|2.0 TDI',
    ]);
  });

  it('expand gives two keys where generations overlap', () => {
    expect(expandVehicleToKeys({ make: 'Volkswagen', model: 'Golf', year: 2019, engine: '2.0 TDI' }, VEHICLE_RECORDS)).toEqual([
      'Volkswagen|Golf|2012|2019|2.0 TDI',
      'Volkswagen|Golf|2019|2024|2.0 TDI',
    ]);
  });

  it('expand is empty for a year the table does not cover', () => {
    expect(expandVehicleToKeys({ make: 'Volkswagen', model: 'Golf', year: 2030, engine: '2.0 TDI' }, VEHICLE_RECORDS)).toEqual([]);
    expect(expandVehicleToKeys({ make: 'Volkswagen', model: 'Golf', year: 2016, engine: '9.9' }, VEHICLE_RECORDS)).toEqual([]);
  });

  it('finds the fitment key for a garage entry, keeping a valid stored key', () => {
    const entry = { make: 'Volkswagen', model: 'Golf', year: 2019, engine: '2.0 TDI' };
    expect(findFitmentKeyFor(VEHICLE_RECORDS, entry)).toBe('Volkswagen|Golf|2012|2019|2.0 TDI');
    expect(findFitmentKeyFor(VEHICLE_RECORDS, { ...entry, fitmentKey: 'Volkswagen|Golf|2019|2024|2.0 TDI' })).toBe('Volkswagen|Golf|2019|2024|2.0 TDI');
    expect(findFitmentKeyFor(VEHICLE_RECORDS, { ...entry, fitmentKey: 'Audi|A3|2012|2020|2.0 TDI' })).toBe('Volkswagen|Golf|2012|2019|2.0 TDI');
    expect(findFitmentKeyFor(VEHICLE_RECORDS, { ...entry, year: 2030 })).toBeNull();
  });
});
