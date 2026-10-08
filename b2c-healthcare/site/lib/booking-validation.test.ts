import { describe, expect, it } from 'vitest';
import { MAX_REASON_LENGTH, validateBookingContact } from './booking-validation';

const good = { name: 'Gina Guest', email: 'gina@example.com', phone: '(555) 010-2030', reason: 'Cough' };

describe('design-pdp: booking contact validation', () => {
  it('a complete guest passes', () => {
    expect(validateBookingContact(good, { guest: true })).toEqual({});
  });

  it('a guest must give all four fields', () => {
    expect(validateBookingContact({}, { guest: true })).toEqual({
      name: 'nameRequired',
      email: 'emailRequired',
      phone: 'phoneRequired',
      reason: 'reasonRequired',
    });
  });

  it('a signed-in patient is asked for phone and reason only', () => {
    expect(validateBookingContact({ phone: '212 555 0100', reason: 'Check-up' }, { guest: false })).toEqual({});
    expect(validateBookingContact({}, { guest: false })).toEqual({ phone: 'phoneRequired', reason: 'reasonRequired' });
  });

  it('rejects a malformed email and a phone with letters or too few digits', () => {
    expect(validateBookingContact({ ...good, email: 'not-an-email' }, { guest: true }).email).toBe('emailInvalid');
    expect(validateBookingContact({ ...good, phone: 'call me' }, { guest: true }).phone).toBe('phoneInvalid');
    expect(validateBookingContact({ ...good, phone: '12345' }, { guest: true }).phone).toBe('phoneInvalid');
    expect(validateBookingContact({ ...good, phone: '+1 212 555 0100' }, { guest: true }).phone).toBeUndefined();
  });

  it('whitespace only is empty and the reason is capped', () => {
    expect(validateBookingContact({ ...good, reason: '   ' }, { guest: true }).reason).toBe('reasonRequired');
    expect(validateBookingContact({ ...good, reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }, { guest: true }).reason).toBe('reasonTooLong');
    expect(validateBookingContact({ ...good, reason: 'x'.repeat(MAX_REASON_LENGTH) }, { guest: true }).reason).toBeUndefined();
  });

  it('problems are codes: no value is echoed back', () => {
    expect(JSON.stringify(validateBookingContact({ ...good, email: 'secret@@x' }, { guest: true }))).not.toContain('secret');
  });
});
