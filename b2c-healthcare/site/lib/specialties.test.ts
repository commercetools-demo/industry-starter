import { describe, expect, it } from 'vitest';
import { CITIES, matchSpecialtyKeys, SPECIALTIES } from '@/lib/specialties';
import { CITIES as SEED_CITIES, SPECIALTIES as SEED_SPECIALTIES } from '@/scripts/seed/data/types';

describe('discovery-and-browse: specialty and city options', () => {
  it('mirror the seeded product type enums', () => {
    expect(SPECIALTIES).toEqual(SEED_SPECIALTIES);
    expect(CITIES).toEqual(SEED_CITIES);
  });
  it('matches a specialty by a partial label', () => {
    expect(matchSpecialtyKeys('derm')).toEqual(['dermatology']);
    expect(matchSpecialtyKeys('ge')).toEqual([]);
    expect(matchSpecialtyKeys('Practice')).toEqual(['general-practice']);
  });
});
