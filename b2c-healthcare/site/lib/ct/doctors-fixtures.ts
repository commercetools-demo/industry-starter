import 'server-only';
import { candidateSlots, type Slot } from '@/lib/clinical/slots';
import { initialsOf } from '@/lib/mappers/doctor';
import { matchSpecialtyKeys, SPECIALTIES } from '@/lib/specialties';
import type { FacetResult } from '@/lib/ct/search';
import type { ConsultationMode, DoctorCard, Medication } from '@/lib/types';
import { MEDICATIONS, medKey, medSku } from '@/scripts/seed/data/medications';
import { DOCTORS, doctorKey } from '@/scripts/seed/data/doctors';
import { REVIEWS } from '@/scripts/seed/data/reviews';
import { SCHEDULES } from '@/scripts/seed/data/schedules';

/**
 * Development-only data switch (`MALVA_FIXTURES=1`): feeds the doctor list and the search page from the seed
 * data (scripts/seed/data) instead of commercetools, so the UI can be checked in a browser without credentials.
 * Never active when NODE_ENV is `production` (see K-questions.md).
 */
export function fixturesEnabled(): boolean {
  return process.env.MALVA_FIXTURES === '1' && process.env.NODE_ENV !== 'production';
}

const USD = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

const doctorCards: DoctorCard[] = DOCTORS.map((d) => {
  const ratings = REVIEWS.filter((r) => r.doctorKey === doctorKey(d)).map((r) => r.rating);
  const modes = (['remote', 'office'] as const).filter((m) => d.fees[m] !== undefined);
  const specialty = SPECIALTIES.find((s) => s.key === d.specialty);
  return {
    id: doctorKey(d),
    key: doctorKey(d),
    slug: d.slug,
    name: d.name,
    specialty: specialty?.label ?? d.specialty,
    specialtyKey: d.specialty,
    yearsExperience: d.yearsExperience,
    clinicName: d.clinicName,
    city: d.city,
    modes: [...modes],
    fees: Object.fromEntries(modes.map((m) => [m, USD(d.fees[m] ?? 0)])),
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    reviewCount: ratings.length,
    initials: initialsOf(d.name),
    portraitUrl: null,
  };
});

export function fixtureCandidates(p: { mode: ConsultationMode; q: string; specialty?: string; city?: string }): { cards: DoctorCard[]; facets: FacetResult[] } {
  const words = p.q.toLowerCase().split(' ').filter(Boolean);
  const specialtyKeys = matchSpecialtyKeys(p.q);
  const cards = doctorCards.filter((c) => {
    if (!c.modes.includes(p.mode)) return false;
    if (p.specialty && c.specialtyKey !== p.specialty) return false;
    if (p.city && c.city !== p.city) return false;
    if (!words.length) return true;
    return words.every((w) => c.name.toLowerCase().includes(w)) || specialtyKeys.includes(c.specialtyKey);
  });
  const count = (field: 'specialtyKey' | 'city') => {
    const by = new Map<string, number>();
    for (const c of cards) by.set(c[field], (by.get(c[field]) ?? 0) + 1);
    return [...by].map(([value, n]) => ({ value, count: n }));
  };
  return { cards, facets: [{ name: 'specialty', buckets: count('specialtyKey') }, { name: 'city', buckets: count('city') }] };
}

export function fixtureAvailability(doctorKeyValue: string, _mode: ConsultationMode, now: Date): Slot[] {
  const schedule = SCHEDULES.find((s) => s.doctorKey === doctorKeyValue)?.schedule;
  return schedule ? candidateSlots(schedule, now, 7) : [];
}

const medicines: Medication[] = MEDICATIONS.map((d) => ({
  id: medKey(d),
  key: medKey(d),
  slug: d.slug,
  name: d.name,
  description: `${d.name}, ${d.packSize} per pack.`,
  sku: medSku(d),
  strength: d.strength,
  dosageForm: d.form === 'capsule' ? 'Capsule' : 'Tablet',
  rxOnly: d.rxOnly,
  dispenseUnit: 'pack',
  minRemainingShelfLifeDays: d.minRemainingShelfLifeDays,
  maxQtyPerOrder: d.maxQtyPerOrder ?? null,
  hsaEligible: d.hsaEligible,
  controlClass: d.controlClass === 'none' ? null : d.controlClass,
  price: USD(d.priceCents),
  imageUrl: null,
  categoryIds: [],
}));

export function fixtureDoctorsByText(q: string): DoctorCard[] {
  const words = q.toLowerCase().split(' ').filter(Boolean);
  const keys = matchSpecialtyKeys(q);
  return doctorCards.filter((c) => words.every((w) => c.name.toLowerCase().includes(w)) || keys.includes(c.specialtyKey));
}

export function fixtureMedicinesByText(q: string): Medication[] {
  const words = q.toLowerCase().split(' ').filter(Boolean);
  return medicines.filter((m) => words.every((w) => m.name.toLowerCase().includes(w)));
}

export function fixtureMedicineBySku(sku: string): Medication | null {
  return medicines.find((m) => m.sku?.toLowerCase() === sku.toLowerCase()) ?? null;
}
