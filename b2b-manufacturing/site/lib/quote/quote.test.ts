import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH as SERVER_MIN } from '../password';
import { MIN_PASSWORD_LENGTH } from './min-password';
import { REFERENCE_PATTERN } from './constants';
import { makeReference } from './reference';
import { emptyFields, parseFields, splitName, validateAll, validateStep } from './validation';

const base = { ...emptyFields('US'), choice: 'plumbing' as const, company: 'Acme', sector: 'manufacturing', addressLine1: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', siteCount: '1', contactName: 'Ada Lovelace', email: 'ada@acme.co', password: 'a-long-passphrase-1' };

describe('malva-request-a-quote › Required information and validation', () => {
  it('Missing service: step 1 says "service" when neither services nor a choice exist', () => {
    expect(validateStep(0, { ...base, choice: '' }, { hasServices: false, signedIn: false })).toEqual({ choice: 'service' });
    expect(validateStep(0, { ...base, choice: '' }, { hasServices: true, signedIn: false })).toEqual({});
  });
  it('step 2 requires company, sector, address, city, postcode and number of sites', () => {
    expect(Object.keys(validateStep(1, emptyFields(), { hasServices: true, signedIn: false }))).toEqual(['company', 'sector', 'addressLine1', 'city', 'postalCode', 'siteCount']);
  });
  it('Invalid email: a bad address is "email"; a throw-away one asks for a work address', () => {
    const ctx = { hasServices: true, signedIn: false };
    expect(validateStep(2, { ...base, email: 'ada@' }, ctx).email).toBe('email');
    expect(validateStep(2, { ...base, email: 'ada@mailinator.com' }, ctx).email).toBe('emailWork');
    expect(validateStep(2, base, ctx)).toEqual({});
  });
  it('an account needs a first and last name and a password of the registration length; a signed-in client needs neither', () => {
    expect(validateStep(2, { ...base, contactName: 'Ada' }, { hasServices: true, signedIn: false }).contactName).toBe('contactNameFull');
    expect(validateStep(2, { ...base, password: 'short' }, { hasServices: true, signedIn: false }).password).toBe('passwordShort');
    expect(validateStep(2, { ...base, password: '', contactName: 'Ada' }, { hasServices: true, signedIn: true })).toEqual({});
    expect(MIN_PASSWORD_LENGTH).toBe(SERVER_MIN);
  });
  it('validateAll reports every step; splitName keeps compound first names', () => {
    expect(Object.keys(validateAll(emptyFields(), { hasServices: false, signedIn: false })).length).toBeGreaterThan(6);
    expect(splitName('Mary Ann Smith')).toEqual({ firstName: 'Mary Ann', lastName: 'Smith' });
    expect(splitName('Ada')).toBeNull();
  });
  it('parseFields drops unknown keys, unknown waste types and unsupported countries', () => {
    const parsed = parseFields({ company: '  Acme ', wasteTypes: ['clinical', 'bogus', 'clinical'], country: 'fr', evil: 'x', email: 'A@B.CO' });
    expect(parsed).toMatchObject({ company: 'Acme', wasteTypes: ['clinical'], country: '', email: 'a@b.co' });
    expect(parsed).not.toHaveProperty('evil');
  });
});

describe('malva-request-a-quote › Submission creates exactly one request', () => {
  it('references are MQ- plus six base-32 characters and do not repeat', () => {
    const refs = new Set(Array.from({ length: 200 }, makeReference));
    expect(refs.size).toBe(200);
    for (const r of refs) expect(r).toMatch(REFERENCE_PATTERN);
  });
});
