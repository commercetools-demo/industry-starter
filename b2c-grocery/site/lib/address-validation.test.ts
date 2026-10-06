import { describe, expect, it } from 'vitest';
import { normalizeAddress, validateAddress } from './address-validation';

const us = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', postalCode: '94105', city: 'San Francisco', country: 'US' };
const de = { firstName: 'Ada', lastName: 'Lovelace', streetName: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin', country: 'DE' };

describe('validateAddress', () => {
  it('valid US and DE addresses have no errors', () => {
    expect(validateAddress(us)).toEqual({});
    expect(validateAddress(de)).toEqual({});
  });

  it.each(['firstName', 'lastName', 'streetName', 'postalCode', 'city', 'country'] as const)('%s is required (blank counts as missing)', (field) => {
    expect(validateAddress({ ...us, [field]: '' })[field]).toBe('required');
    expect(validateAddress({ ...us, [field]: '   ' })[field]).toBe('required');
    const { [field]: _omit, ...rest } = us;
    expect(validateAddress(rest)[field]).toBe('required');
  });

  it('additional line and phone are optional', () => {
    expect(validateAddress({ ...us, additionalStreetInfo: '', phone: '' })).toEqual({});
  });

  it('Invalid postcode: US accepts 5 digits and ZIP+4, rejects the rest', () => {
    expect(validateAddress({ ...us, postalCode: '94105-1234' })).toEqual({});
    for (const bad of ['9410', '941055', '94105-12', 'ABCDE', '94105 1234']) expect(validateAddress({ ...us, postalCode: bad }).postalCode).toBe('invalidPostcode');
  });

  it('Invalid postcode: DE accepts exactly 5 digits', () => {
    expect(validateAddress({ ...de, postalCode: '1011' }).postalCode).toBe('invalidPostcode');
    expect(validateAddress({ ...de, postalCode: '10115-1234' }).postalCode).toBe('invalidPostcode');
    expect(validateAddress({ ...de, postalCode: 'D-10115' }).postalCode).toBe('invalidPostcode');
  });

  it('the postcode is checked against the chosen country', () => {
    expect(validateAddress({ ...de, country: 'US', postalCode: '10115-12' }).postalCode).toBe('invalidPostcode');
    expect(validateAddress({ ...us, country: 'DE', postalCode: '94105-1234' }).postalCode).toBe('invalidPostcode');
  });

  it('country must be US or DE', () => {
    expect(validateAddress({ ...us, country: 'FR' }).country).toBe('invalidCountry');
    expect(validateAddress({ ...us, country: 'FR' }).postalCode).toBeUndefined();
  });

  it('phone: optional, but when given it needs the format', () => {
    expect(validateAddress({ ...us, phone: '+1 415-555-0100' })).toEqual({});
    expect(validateAddress({ ...us, phone: '415 555 0100' })).toEqual({});
    expect(validateAddress({ ...us, phone: 'call me' }).phone).toBe('invalidPhone');
    expect(validateAddress({ ...us, phone: '12' }).phone).toBe('invalidPhone');
  });

  it('values over 100 characters are rejected; non-strings count as missing', () => {
    expect(validateAddress({ ...us, city: 'x'.repeat(101) }).city).toBe('tooLong');
    expect(validateAddress({ ...us, city: 5 }).city).toBe('required');
  });
});

describe('normalizeAddress', () => {
  it('trims and keeps optional fields only when filled', () => {
    expect(normalizeAddress({ ...us, firstName: ' Ada ', additionalStreetInfo: ' ', phone: ' 12345678 ', extra: 'x' } as never)).toEqual({ ...us, phone: '12345678' });
  });
});
