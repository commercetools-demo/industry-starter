import { describe, expect, it } from 'vitest';
import { DOCTORS, doctorKey } from '@/scripts/seed/data/doctors';
import { fixtureCandidates, fixtureDoctor, fixtureDoctorsByText, fixtureMedicinesByText } from './doctors-fixtures';

describe('fixtures mode', () => {
  it('has no photos: cards and medicines show the placeholder', () => {
    const { cards } = fixtureCandidates({ mode: 'remote', q: '' });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.portraitUrl === null)).toBe(true);
    expect(fixtureDoctor(doctorKey(DOCTORS[0]))?.portraitUrl).toBeNull();
    expect(fixtureMedicinesByText('').every((m) => m.imageUrl === null)).toBe(true);
  });

  it('a typed clinic name finds the doctors of that clinic, as the live query does (D-039)', () => {
    const clinic = DOCTORS[0].clinicName.split(' ')[0].toLowerCase();
    const hits = fixtureDoctorsByText(clinic);
    expect(hits.some((h) => h.key === doctorKey(DOCTORS[0]))).toBe(true);
    expect(fixtureCandidates({ mode: 'remote', q: DOCTORS[0].clinicName }).cards.every((c) => c.modes.includes('remote'))).toBe(true);
  });
});
