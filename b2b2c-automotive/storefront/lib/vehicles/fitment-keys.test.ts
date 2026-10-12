// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { expandVehicleToKeys } from './catalog';
import { groupRangesForDisplay, parseFitmentKey, vehicleInRange } from './fitment-keys';
import { VEHICLE_RECORDS } from './test-fixtures';

const golfRange = { make: 'Volkswagen', model: 'Golf', yearFrom: 2012, yearTo: 2019, engine: '2.0 TDI' };
const golf = (year: number, engine = '2.0 TDI') => ({ make: 'Volkswagen', model: 'Golf', year, engine });

describe('Fitment range keys', () => {
  it('parses a five part key', () => {
    expect(parseFitmentKey('Volkswagen|Golf|2012|2019|2.0 TDI')).toEqual(golfRange);
  });

  it('rejects a key with four parts or reversed years', () => {
    expect(parseFitmentKey('Volkswagen|Golf|2012|2.0 TDI')).toBeNull();
    expect(parseFitmentKey('Volkswagen|Golf|2019|2012|2.0 TDI')).toBeNull();
    expect(parseFitmentKey('Volkswagen|Golf|abcd|2019|2.0 TDI')).toBeNull();
    expect(parseFitmentKey('Volkswagen|Golf|2012|2019|')).toBeNull();
  });

  it('engine with a dot and space survives', () => {
    expect(parseFitmentKey('Toyota|Camry|2018|2024|3.5 V6')?.engine).toBe('3.5 V6');
  });

  it('year equal to from and to is inside', () => {
    expect(vehicleInRange(golf(2012), golfRange)).toBe(true);
    expect(vehicleInRange(golf(2019), golfRange)).toBe(true);
  });

  it('year one outside is not', () => {
    expect(vehicleInRange(golf(2011), golfRange)).toBe(false);
    expect(vehicleInRange(golf(2020), golfRange)).toBe(false);
  });

  it('different engine does not fit', () => {
    expect(vehicleInRange(golf(2016, '1.4 TSI'), golfRange)).toBe(false);
    expect(vehicleInRange({ ...golf(2016), make: 'Audi' }, golfRange)).toBe(false);
    expect(vehicleInRange({ ...golf(2016), model: 'Polo' }, golfRange)).toBe(false);
  });

  it('groups ranges for display by make and model', () => {
    const grouped = groupRangesForDisplay([
      'Volkswagen|Golf|2012|2019|2.0 TDI',
      'Volkswagen|Golf|2012|2019|1.4 TSI',
      'Volkswagen|Golf|2019|2024|2.0 TDI',
      'Audi|A3|2012|2020|2.0 TDI',
      'broken',
    ]);
    expect(grouped).toEqual([
      { make: 'Audi', model: 'A3', yearFrom: 2012, yearTo: 2020, engines: ['2.0 TDI'] },
      { make: 'Volkswagen', model: 'Golf', yearFrom: 2012, yearTo: 2019, engines: ['1.4 TSI', '2.0 TDI'] },
      { make: 'Volkswagen', model: 'Golf', yearFrom: 2019, yearTo: 2024, engines: ['2.0 TDI'] },
    ]);
  });

  it('expansion and range test agree for every vehicle record and year', () => {
    for (const record of VEHICLE_RECORDS) {
      for (let year = record.yearFrom - 1; year <= record.yearTo + 1; year += 1) {
        const vehicle = { make: record.make, model: record.model, year, engine: record.engine };
        const keys = expandVehicleToKeys(vehicle, VEHICLE_RECORDS);
        for (const other of VEHICLE_RECORDS) {
          const range = parseFitmentKey(other.fitmentKey);
          expect(range).not.toBeNull();
          expect(keys.includes(other.fitmentKey)).toBe(vehicleInRange(vehicle, range!));
        }
      }
    }
  });
});
