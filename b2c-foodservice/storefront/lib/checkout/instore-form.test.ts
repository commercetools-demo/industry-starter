import { describe, expect, it } from 'vitest';
import { parseInstoreForm } from '@/lib/checkout/instore-form';

describe('parseInstoreForm', () => {
  it('accepts a name with an email, trimmed', () => {
    expect(parseInstoreForm({ who: { mode: 'name', name: ' Sam Rivera ' }, notify: { mode: 'email', email: ' sam@x.co ' } })).toEqual({
      who: { mode: 'name', name: 'Sam Rivera' },
      notify: { mode: 'email', email: 'sam@x.co' },
    });
  });
  it('accepts a badge with a phone number', () => {
    expect(parseInstoreForm({ who: { mode: 'badge' }, notify: { mode: 'phone', phone: '+1 555 123 4567' } })).not.toBeNull();
  });
  it.each([
    null,
    {},
    { who: { mode: 'name', name: 'S' }, notify: { mode: 'email', email: 'a@b.co' } },
    { who: { mode: 'name', name: 'Sam' }, notify: { mode: 'email', email: 'nope' } },
    { who: { mode: 'name', name: 'Sam' }, notify: { mode: 'phone', phone: '12' } },
    { who: { mode: 'x' }, notify: { mode: 'email', email: 'a@b.co' } },
  ])('refuses %j', (body) => {
    expect(parseInstoreForm(body)).toBeNull();
  });
});
