import { describe, expect, it } from 'vitest';
import { getAccreditations, getAudiences, getContact, getStats, getTestimonials, text } from './content';

describe('malva-homepage › Proof content is managed and never rendered empty (loaders)', () => {
  it('returns validated arrays with the expected counts and every item flagged sample until SO-04', () => {
    expect(getStats()).toHaveLength(4);
    expect(getAccreditations()).toHaveLength(4);
    expect(getTestimonials()).toHaveLength(3);
    expect(getAudiences().map((a) => a.sector)).toEqual(['facilities', 'manufacturing', 'property', 'healthcare']);
    expect([...getStats(), ...getAccreditations(), ...getTestimonials(), ...getAudiences()].every((i) => i.sample)).toBe(true);
    expect(getContact().hours['en-US']).toBe('Mon–Fri 7:30–18:00');
  });
  it('text() picks the locale, then the same language, then en-US', () => {
    const field = { 'en-US': 'Hello', 'de-DE': 'Hallo' };
    expect(text(field, 'de-DE')).toBe('Hallo');
    expect(text(field, 'de-AT')).toBe('Hallo');
    expect(text(field, 'fr-FR')).toBe('Hello');
  });
});
