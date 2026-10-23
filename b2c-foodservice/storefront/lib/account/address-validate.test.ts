import { describe, expect, it } from 'vitest';
import { validateAddress } from '@/lib/account/address-validate';

const ok = { firstName: 'Maya', lastName: 'Okonkwo', streetName: '100 Example Street', city: 'New York', postalCode: '10012', state: 'ny', country: 'US' };

describe('validateAddress', () => {
  it('normalises a good US address', () => {
    const r = validateAddress({ ...ok, phone: '+1 212 555 0100', label: ' Home ' });
    expect(r).toEqual({ ok: true, address: { ...ok, state: 'NY', phone: '+1 212 555 0100', label: 'Home' } });
  });

  it('Invalid postcode is refused with field codes', () => {
    expect(validateAddress({ ...ok, postalCode: '1001' })).toEqual({ ok: false, fields: { postalCode: 'invalid' } });
    expect(validateAddress({ ...ok, postalCode: 'M5V 2T6' })).toEqual({ ok: false, fields: { postalCode: 'invalid' } });
    expect(validateAddress({ ...ok, country: 'CA', state: undefined, postalCode: '10012' })).toEqual({ ok: false, fields: { postalCode: 'invalid' } });
  });

  it('accepts a Canadian postal code and upper-cases it; the state is not asked for', () => {
    const r = validateAddress({ ...ok, country: 'CA', state: '', postalCode: 'm5v 2t6' });
    expect(r).toMatchObject({ ok: true, address: { country: 'CA', postalCode: 'M5V 2T6' } });
    expect((r as { address: { state?: string } }).address.state).toBeUndefined();
  });

  it('State field only for US: required there, unknown codes refused', () => {
    expect(validateAddress({ ...ok, state: '' })).toEqual({ ok: false, fields: { state: 'required' } });
    expect(validateAddress({ ...ok, state: 'ZZ' })).toEqual({ ok: false, fields: { state: 'invalid' } });
  });

  it('names every missing required field', () => {
    expect(validateAddress({})).toEqual({
      ok: false,
      fields: { firstName: 'required', lastName: 'required', streetName: 'required', city: 'required', country: 'required', postalCode: 'required' },
    });
    expect(validateAddress(null).ok).toBe(false);
  });

  it('refuses a country outside the two markets, a bad phone and over-long text', () => {
    expect(validateAddress({ ...ok, country: 'DE' })).toMatchObject({ ok: false, fields: { country: 'unsupported' } });
    expect(validateAddress({ ...ok, phone: 'call me' })).toEqual({ ok: false, fields: { phone: 'invalid' } });
    expect(validateAddress({ ...ok, city: 'x'.repeat(61) })).toEqual({ ok: false, fields: { city: 'too_long' } });
  });

  it('names follow the checkout rule: letters, spaces and apostrophes pass, digits and symbols do not', () => {
    expect(validateAddress({ ...ok, firstName: "Siobhán", lastName: "O'Brien-Núñez" }).ok).toBe(true);
    expect(validateAddress({ ...ok, firstName: 'M4ya' })).toEqual({ ok: false, fields: { firstName: 'invalid' } });
    expect(validateAddress({ ...ok, lastName: '<script>' })).toEqual({ ok: false, fields: { lastName: 'invalid' } });
  });
});
