import { describe, expect, it } from 'vitest';
import { US_STATES, addressWarning, defaultAddress, normalizePhone, stateForZip, validateAddress } from './address';
import type { Address } from './types';

const valid = { firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '(512) 555-0100' };

describe('address-book: format validation', () => {
  it.each([
    ['12345', true],
    ['12345-6789', true],
    ['1234', false],
    ['123456', false],
    ['12345-678', false],
    ['1234a', false],
    ['12345 6789', false],
    ['', false],
  ])('ZIP %j valid=%s', (zip, ok) => {
    const result = validateAddress({ ...valid, zip });
    expect(result.ok).toBe(ok);
    if (!ok && !result.ok) expect(result.problems.zip).toBe(zip ? 'invalid' : 'required');
  });

  it.each([
    ['5125550100', '+15125550100'],
    ['(512) 555-0100', '+15125550100'],
    ['512.555.0100', '+15125550100'],
    ['512-555-0100', '+15125550100'],
    ['1 512 555 0100', '+15125550100'],
    ['+1 512 555 0100', '+15125550100'],
    ['+15125550100', '+15125550100'],
    ['15125550100', '+15125550100'],
    ['555-0100', null],
    ['+5125550100', null],
    ['+44 20 7946 0958', null],
    ['25125550100', null],
    ['512 555 01000', null],
    ['call me', null],
    ['512+5550100', null],
    ['', null],
  ])('phone %j normalises to %j', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('every US state and DC is accepted, others are not', () => {
    expect(US_STATES).toHaveLength(51);
    for (const state of US_STATES) expect(validateAddress({ ...valid, state, zip: '12345' }).ok).toBe(true);
    for (const state of ['ZZ', 'Texas', 'PR', 'T']) {
      const result = validateAddress({ ...valid, state });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems.state).toBe('invalid');
    }
  });

  it('a lower-case state is normalised', () => {
    const result = validateAddress({ ...valid, state: 'tx' });
    expect(result.ok && result.value.state).toBe('TX');
  });

  it('names, street, city, state, ZIP and phone are required; the additional line is optional', () => {
    const result = validateAddress({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual({
        firstName: 'required',
        lastName: 'required',
        street: 'required',
        city: 'required',
        state: 'required',
        zip: 'required',
        phone: 'required',
      });
    }
    expect(validateAddress({ ...valid, street2: 'Apt 4' }).ok).toBe(true);
  });

  it('whitespace-only values count as empty; inner spaces collapse; the phone is returned as +1…', () => {
    const result = validateAddress({ ...valid, firstName: '   ', lastName: ' Van   Der  Berg ' });
    expect(result.ok).toBe(false);
    const good = validateAddress({ ...valid, lastName: ' Van   Der  Berg ' });
    expect(good.ok && good.value.lastName).toBe('Van Der Berg');
    expect(good.ok && good.value.phone).toBe('+15125550100');
  });

  it('non-string values and non-objects are treated as missing', () => {
    expect(validateAddress(null).ok).toBe(false);
    expect(validateAddress('x').ok).toBe(false);
    expect(validateAddress({ ...valid, zip: 78701 }).ok).toBe(false);
  });

  it('over-long values are invalid', () => {
    const result = validateAddress({ ...valid, street: 'x'.repeat(201), city: 'y'.repeat(101) });
    expect(!result.ok && result.problems).toEqual({ street: 'invalid', city: 'invalid' });
  });
});

describe('address-book: Validation cannot resolve the address (state and ZIP prefix table)', () => {
  it.each([
    ['02101', 'MA'],
    ['10001', 'NY'],
    ['19103', 'PA'],
    ['20001', 'DC'],
    ['22201', 'VA'],
    ['30301', 'GA'],
    ['33101', 'FL'],
    ['60601', 'IL'],
    ['73101', 'OK'],
    ['78701', 'TX'],
    ['80202', 'CO'],
    ['90001', 'CA'],
    ['94105-1234', 'CA'],
    ['97201', 'OR'],
    ['98101', 'WA'],
    ['99501', 'AK'],
    ['96801', 'HI'],
    ['89101', 'NV'],
    ['85001', 'AZ'],
    ['55401', 'MN'],
  ])('ZIP %s belongs to %s', (zip, state) => {
    expect(stateForZip(zip)).toBe(state);
    expect(addressWarning({ state, zip })).toBeNull();
  });

  it.each(['00501', '96201', '96601', 'abcde', '1234'])('ZIP %s has no table entry: never warns', (zip) => {
    expect(stateForZip(zip)).toBeNull();
    expect(addressWarning({ state: 'TX', zip })).toBeNull();
  });

  it('a mismatch names the fields and the nearest match (the state of the ZIP)', () => {
    expect(addressWarning({ state: 'NY', zip: '90210' })).toEqual({ fields: ['state', 'zip'], nearestState: 'CA' });
  });

  it('a mismatch does not make the address invalid (warning, not a block)', () => {
    const result = validateAddress({ ...valid, state: 'NY', zip: '90210' });
    expect(result.ok).toBe(true);
  });
});

describe('address-book: default selector', () => {
  const base: Address = { id: 'a', firstName: 'S', lastName: 'R', street: 's', street2: '', city: 'c', state: 'TX', zip: '78701', phone: '+15125550100', country: 'US', isDefault: false };
  it('Default preselected for a new order: the default is returned, the others stay offered', () => {
    const list = [base, { ...base, id: 'b', isDefault: true }, { ...base, id: 'c' }];
    expect(defaultAddress(list)?.id).toBe('b');
  });
  it('no default (or no address) returns null so checkout asks the buyer to choose', () => {
    expect(defaultAddress([base])).toBeNull();
    expect(defaultAddress([])).toBeNull();
  });
});
