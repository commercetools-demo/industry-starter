// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CustomObject } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapVehicleRecord } from './vehicle';

const obj = (value: unknown): CustomObject =>
  ({ id: '1', version: 1, createdAt: '', lastModifiedAt: '', container: 'mau-vehicles', key: 'mau-veh-x', value }) as CustomObject;

const good = { make: 'Volkswagen', model: 'Golf', generation: 'VII', yearFrom: 2012, yearTo: 2019, engine: '2.0 TDI', markets: ['DE'], fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI' };

describe('Vehicle table mapper', () => {
  it('maps a table object to a record', () => {
    expect(mapVehicleRecord(obj(good))).toEqual(good);
  });

  it('rejects objects with missing or inconsistent fields', () => {
    expect(mapVehicleRecord(obj({ ...good, fitmentKey: undefined }))).toBeNull();
    expect(mapVehicleRecord(obj({ ...good, yearFrom: 2020 }))).toBeNull();
    expect(mapVehicleRecord(obj({ ...good, yearTo: '2019' }))).toBeNull();
    expect(mapVehicleRecord(obj(null))).toBeNull();
  });

  it('rejects a fitment key that does not match the record', () => {
    expect(mapVehicleRecord(obj({ ...good, fitmentKey: 'Audi|A3|2012|2019|2.0 TDI' }))).toBeNull();
  });

  it('keeps only DE and US markets and tolerates a missing generation', () => {
    const mapped = mapVehicleRecord(obj({ ...good, generation: undefined, markets: ['DE', 'FR', 3] }));
    expect(mapped?.markets).toEqual(['DE']);
    expect(mapped?.generation).toBe('');
  });
});
