/**
 * Specialty and city options of the doctor list. They mirror the enum values of the seeded `doctor` product
 * type (scripts/seed/data/types.ts; `specialties.test.ts` keeps them in sync), so the filter bar and the
 * browse chips need no search call. Pure data: no server imports.
 */
export interface Option {
  key: string;
  label: string;
}

export const SPECIALTIES: readonly Option[] = [
  { key: 'general-practice', label: 'General Practice' },
  { key: 'dermatology', label: 'Dermatology' },
  { key: 'psychiatry', label: 'Psychiatry' },
  { key: 'pediatrics', label: 'Pediatrics' },
  { key: 'cardiology', label: 'Cardiology' },
  { key: 'orthopedics', label: 'Orthopedics' },
  { key: 'gynecology', label: 'Gynecology' },
];

export const CITIES: readonly Option[] = [
  { key: 'new-york', label: 'New York' },
  { key: 'austin', label: 'Austin' },
  { key: 'chicago', label: 'Chicago' },
];

/** Specialty keys whose label or key contains the text (case-insensitive); so "derm" finds dermatologists. */
export function matchSpecialtyKeys(text: string): string[] {
  const needle = text.trim().toLowerCase();
  if (needle.length < 3) return [];
  return SPECIALTIES.filter((s) => s.label.toLowerCase().includes(needle) || s.key.includes(needle)).map((s) => s.key);
}
