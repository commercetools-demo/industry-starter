import { describe, expect, it } from 'vitest';
import { validateContact } from './validate';

const VALID = { name: 'Maya Test', email: 'maya@example.com', topic: 'order', orderNumber: '', message: 'A message that is long enough.', consent: true };

describe('validateContact', () => {
  it('accepts a valid enquiry and trims', () => {
    const r = validateContact({ ...VALID, name: '  Maya Test  ' });
    expect(r.ok && r.value.name).toBe('Maya Test');
  });
  it('reports one code per failing field', () => {
    const r = validateContact({ name: '', email: 'x', topic: 'nope', orderNumber: 'a b', message: 'short', consent: false });
    expect(r).toEqual({
      ok: false,
      errors: { name: 'required', email: 'emailInvalid', topic: 'required', orderNumber: 'orderNumberInvalid', message: 'tooShort', consent: 'consentRequired' },
    });
  });
  it('limits', () => {
    expect(validateContact({ ...VALID, name: 'M' })).toMatchObject({ errors: { name: 'tooShort' } });
    expect(validateContact({ ...VALID, name: 'M'.repeat(81) })).toMatchObject({ errors: { name: 'tooLong' } });
    expect(validateContact({ ...VALID, message: 'm'.repeat(2001) })).toMatchObject({ errors: { message: 'tooLong' } });
    expect(validateContact({ ...VALID, orderNumber: 'AB' })).toMatchObject({ errors: { orderNumber: 'orderNumberInvalid' } });
  });
  it('non-object input fails every required field', () => {
    expect(validateContact(null).ok).toBe(false);
  });
});
