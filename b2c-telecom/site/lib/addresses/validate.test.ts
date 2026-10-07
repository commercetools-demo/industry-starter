import { validateAddress } from './validate';
import type { AddressInput } from '@/lib/types';

const us: AddressInput = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: true };
const de: AddressInput = { firstName: 'Ada', lastName: 'Lovelace', streetName: 'Hauptstr. 1', city: 'Berlin', postalCode: '10115', country: 'DE', isService: true, isBilling: true };

describe('validateAddress', () => {
  it('accepts a valid US and DE address', () => {
    expect(validateAddress(us)).toEqual({});
    expect(validateAddress(de)).toEqual({});
  });
  it('requires first name, last name, street, city, ZIP and country', () => {
    const errors = validateAddress({});
    expect(errors).toMatchObject({ firstName: 'required', lastName: 'required', streetName: 'required', city: 'required', postalCode: 'required', country: 'required' });
    expect(validateAddress({ ...us, city: '   ' }).city).toBe('required');
  });
  it('requires a state only in the US', () => {
    expect(validateAddress({ ...us, state: '' }).state).toBe('required');
    expect(validateAddress({ ...de, state: undefined }).state).toBeUndefined();
  });
  it('rejects an unknown country and an unknown state', () => {
    expect(validateAddress({ ...us, country: 'FR' as 'US' }).country).toBe('invalidCountry');
    expect(validateAddress({ ...us, state: 'ZZ' }).state).toBe('invalidState');
    expect(validateAddress({ ...us, state: 'DC' }).state).toBeUndefined();
  });
  it('checks the US ZIP (five digits, ZIP+4 keeps its dash)', () => {
    expect(validateAddress({ ...us, postalCode: '1234' }).postalCode).toBe('invalidPostalCode');
    expect(validateAddress({ ...us, postalCode: '10001-1234' })).toEqual({});
    expect(validateAddress({ ...us, postalCode: '100011234' }).postalCode).toBe('invalidPostalCode');
  });
  it('checks the German postal code (exactly five digits)', () => {
    expect(validateAddress({ ...de, postalCode: '1011' }).postalCode).toBe('invalidPostalCode');
    expect(validateAddress({ ...de, postalCode: '10115-1234' }).postalCode).toBe('invalidPostalCode');
  });
  it('validates an optional phone', () => {
    expect(validateAddress({ ...us, phone: '' })).toEqual({});
    expect(validateAddress({ ...us, phone: '+1 (212) 555-0100' })).toEqual({});
    expect(validateAddress({ ...us, phone: 'call me' }).phone).toBe('invalidPhone');
  });
  it('limits every text to 100 characters', () => {
    expect(validateAddress({ ...us, streetName: 'x'.repeat(101) }).streetName).toBe('tooLong');
    expect(validateAddress({ ...us, streetName: 'x'.repeat(100) })).toEqual({});
  });
});
