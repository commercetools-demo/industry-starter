import { describe, expect, it } from 'vitest';
import { currencyMatchesCountry, normaliseCode, validateCode, validatePerson, validatePickup, validatePickupName } from './validate';

describe('checkout validators', () => {
  it('Pickup name is required when something is collected', () => {
    expect(validatePickupName('', true)).toBe('pickup_name_required');
    expect(validatePickupName('   ', true)).toBe('pickup_name_required');
    expect(validatePickupName('', false)).toBeNull();
    expect(validatePickup({ person: 'me', pickupName: '' }, true)).toEqual({ pickupName: 'pickup_name_required' });
    expect(validatePickup({ person: 'x', pickupName: '' }, false)).toEqual({});
  });
  it('Pickup name accepts accents and apostrophes', () => {
    for (const n of ['José Núñez', "O'Brien", 'Anne-Marie St. Clair', 'Zoë', 'Dvořák Ñ']) expect(validatePickupName(n, true)).toBeNull();
  });
  it('Pickup name rejects markup', () => {
    for (const n of ['<script>', 'Bob<b>', 'a', 'x'.repeat(81), '123', 'Bob; DROP']) expect(validatePickupName(n, true)).toBe('pickup_name_invalid');
  });
  it('Pickup person must be me or other', () => {
    expect(validatePerson('me')).toBeNull();
    expect(validatePerson('other')).toBeNull();
    expect(validatePerson('them')).toBe('person_invalid');
    expect(validatePerson(undefined)).toBe('person_invalid');
  });
  it('Promo code is normalised and checked', () => {
    expect(normaliseCode('  welcome10 ')).toBe('WELCOME10');
    expect(validateCode(' welcome10 ')).toBeNull();
    expect(validateCode('a')).toBe('code_malformed');
    expect(validateCode('has space')).toBe('code_malformed');
    expect(validateCode(5)).toBe('code_malformed');
  });
  it('Canada currency and country pair is accepted', () => {
    expect(currencyMatchesCountry('CA', 'CAD')).toBe(true);
    expect(currencyMatchesCountry('US', 'USD')).toBe(true);
    expect(currencyMatchesCountry('CA', 'USD')).toBe(false);
  });
});
