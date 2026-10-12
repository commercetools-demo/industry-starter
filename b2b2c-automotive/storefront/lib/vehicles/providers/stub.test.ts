// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { stubProvider } from './stub';

describe('Mock plate and VIN provider ("Demo lookup")', () => {
  it('known plate resolves', async () => {
    const result = await stubProvider.lookupPlate({ plate: 'B-AB 1234', country: 'DE' });
    expect(result).toEqual({
      status: 'resolved',
      vehicle: { id: 'volkswagen.golf.2016.2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI' },
    });
    expect(await stubProvider.lookupPlate({ plate: '7ABC123', country: 'US' })).toMatchObject({ status: 'resolved', vehicle: { id: 'toyota.camry.2020.2-5' } });
  });

  it('plates match regardless of spacing and dashes', async () => {
    expect((await stubProvider.lookupPlate({ plate: 'BAB1234', country: 'DE' })).status).toBe('resolved');
  });

  it('second plate needs engine', async () => {
    expect(await stubProvider.lookupPlate({ plate: 'HH-XY 99', country: 'DE' })).toEqual({
      status: 'needs-engine',
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      engines: [
        { key: '1-4-tsi', label: '1.4 TSI' },
        { key: '2-0-tdi', label: '2.0 TDI' },
      ],
    });
  });

  it('unknown plate not found, and a fixture plate of another country is not found', async () => {
    expect(await stubProvider.lookupPlate({ plate: 'ZZ 0', country: 'DE' })).toEqual({ status: 'not-found' });
    expect(await stubProvider.lookupPlate({ plate: 'B-AB 1234', country: 'US' })).toEqual({ status: 'not-found' });
  });

  it('known vin resolves', async () => {
    expect(await stubProvider.lookupVin({ vin: 'WVWZZZAUZGW000001' })).toMatchObject({ status: 'resolved', vehicle: { id: 'volkswagen.golf.2016.2-0-tdi' } });
  });

  it('any other 17 character vin is not found', async () => {
    expect(await stubProvider.lookupVin({ vin: 'WVWZZZAUZGW000002' })).toEqual({ status: 'not-found' });
  });

  it('identifies itself as the stub', () => {
    expect(stubProvider.id).toBe('stub');
  });
});
