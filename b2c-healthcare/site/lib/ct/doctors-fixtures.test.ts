import { describe, expect, it } from 'vitest';
import storedImages from '@/scripts/seed/data/product-images.json';
import { DOCTORS, doctorKey } from '@/scripts/seed/data/doctors';
import { fixtureCandidates, fixtureDoctor, fixtureDoctorsByText, fixtureMedicinesByText, storedImageUrl } from './doctors-fixtures';

describe('fixtures mode shows the stored photos without credentials', () => {
  it('every doctor card and profile carries the first stored photo of its product', () => {
    const { cards } = fixtureCandidates({ mode: 'remote', q: '' });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const first = (storedImages as Record<string, { url: string }[]>)[card.key][0].url;
      expect(card.portraitUrl).toBe(first);
      expect(card.portraitUrl).not.toMatch(/[?#]/);
    }
    expect(fixtureDoctor(doctorKey(DOCTORS[0]))?.portraitUrl).toMatch(/^https:\/\//);
  });

  it('every medicine fixture has its photo', () => {
    const meds = fixtureMedicinesByText('');
    expect(meds.length).toBe(20);
    expect(meds.every((m) => typeof m.imageUrl === 'string')).toBe(true);
  });

  it('only clean https URLs are used', () => {
    expect(storedImageUrl('k', { k: [{ url: 'https://h/a.jpg?w=1' }] })).toBeNull();
    expect(storedImageUrl('k', { k: [{ url: 'http://h/a.jpg' }] })).toBeNull();
    expect(storedImageUrl('missing', {})).toBeNull();
    expect(storedImageUrl('k', { k: [{ url: 'https://h/a.jpg' }] })).toBe('https://h/a.jpg');
  });

  it('a typed clinic name finds the doctors of that clinic, as the live query does', () => {
    const clinic = DOCTORS[0].clinicName.split(' ')[0].toLowerCase();
    const hits = fixtureDoctorsByText(clinic);
    expect(hits.some((h) => h.key === doctorKey(DOCTORS[0]))).toBe(true);
    expect(fixtureCandidates({ mode: 'remote', q: DOCTORS[0].clinicName }).cards.every((c) => c.modes.includes('remote'))).toBe(true);
  });
});
