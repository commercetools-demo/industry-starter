// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildVehicleId, isVehicleId, parseVehicleId, slugPart } from './id';

describe('Vehicle ids', () => {
  it('builds and parses round trip', () => {
    const id = buildVehicleId({ make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' });
    expect(id).toBe('volkswagen.golf.2016.2-0-tdi');
    expect(parseVehicleId(id)).toEqual({ make: 'volkswagen', model: 'golf', year: 2016, engine: '2-0-tdi' });
    expect(isVehicleId(id)).toBe(true);
  });

  it('slugs handle spaces, dashes and umlauts', () => {
    expect(slugPart('3 Series')).toBe('3-series');
    expect(slugPart('Mercedes-Benz')).toBe('mercedes-benz');
    expect(slugPart('Škoda Größe')).toBe('skoda-groesse');
    expect(buildVehicleId({ make: 'BMW', model: '3 Series', year: 2017, engine: '320d' })).toBe('bmw.3-series.2017.320d');
  });

  it('rejects uppercase and spaces', () => {
    expect(isVehicleId('Volkswagen.golf.2016.2-0-tdi')).toBe(false);
    expect(isVehicleId('volkswagen.golf.2016.2 0 tdi')).toBe(false);
    expect(parseVehicleId('volkswagen.golf.2016.2 0 tdi')).toBeNull();
  });

  it('rejects three-part ids', () => {
    expect(isVehicleId('volkswagen.golf.2016')).toBe(false);
    expect(parseVehicleId('volkswagen.golf.2016')).toBeNull();
    expect(isVehicleId('volkswagen.golf.16.2-0-tdi')).toBe(false);
  });
});
