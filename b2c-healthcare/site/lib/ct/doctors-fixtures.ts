import 'server-only';
import { candidateSlots, type Schedule, type Slot } from '@/lib/clinical/slots';
import { initialsOf } from '@/lib/mappers/doctor';
import { matchSpecialtyKeys, SPECIALTIES } from '@/lib/specialties';
import type { FacetResult } from '@/lib/ct/search';
import type { ConsultationMode, DoctorCard, DoctorProfile, Medication } from '@/lib/types';
import { MEDICATIONS, medKey, medSku } from '@/scripts/seed/data/medications';
import { DOCTORS, doctorKey } from '@/scripts/seed/data/doctors';
import { REVIEWS } from '@/scripts/seed/data/reviews';
import { SCHEDULES } from '@/scripts/seed/data/schedules';
import storedImages from '@/scripts/seed/data/product-images.json';

/** The photo the seed stores for a product (`scripts/seed/data/product-images.json`), so fixtures mode shows images without credentials. Clean https URLs only. */
export function storedImageUrl(key: string, images: unknown = storedImages): string | null {
  const first = (images as Record<string, { url?: unknown }[] | undefined>)[key]?.[0]?.url;
  return typeof first === 'string' && first.startsWith('https://') && !/[?#]/.test(first) ? first : null;
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
    portraitUrl: storedImageUrl(doctorKey(d)),
  };
});

/** Same rule as the live query: every typed word appears in the clinic name (D-039). */
const matchesClinic = (c: DoctorCard, words: string[]) => words.length > 0 && words.every((w) => (c.clinicName ?? '').toLowerCase().includes(w));

export function fixtureCandidates(p: { mode: ConsultationMode; q: string; specialty?: string; city?: string }): { cards: DoctorCard[]; facets: FacetResult[] } {
  const words = p.q.toLowerCase().split(' ').filter(Boolean);
  const specialtyKeys = matchSpecialtyKeys(p.q);
  const cards = doctorCards.filter((c) => {
    if (!c.modes.includes(p.mode)) return false;
    if (p.specialty && c.specialtyKey !== p.specialty) return false;
    if (p.city && c.city !== p.city) return false;
    if (!words.length) return true;
    return words.every((w) => c.name.toLowerCase().includes(w)) || specialtyKeys.includes(c.specialtyKey) || matchesClinic(c, words);
  });
  const count = (field: 'specialtyKey' | 'city') => {
    const by = new Map<string, number>();
    for (const c of cards) by.set(c[field], (by.get(c[field]) ?? 0) + 1);
    return [...by].map(([value, n]) => ({ value, count: n }));
  };
  return { cards, facets: [{ name: 'specialty', buckets: count('specialtyKey') }, { name: 'city', buckets: count('city') }] };
}

/** The profile of a seeded doctor (reviews dated back from 2026-09 so the "Mon YYYY" line has something to show). */
export function fixtureDoctor(key: string): DoctorProfile | null {
  const def = DOCTORS.find((d) => doctorKey(d) === key);
  const card = doctorCards.find((c) => c.key === key);
  if (!def || !card) return null;
  const reviews = REVIEWS.filter((r) => r.doctorKey === key).map((r, i) => ({
    id: r.key,
    rating: r.rating,
    title: r.title,
    text: r.text,
    createdAt: new Date(Date.UTC(2026, 8 - i, 12)).toISOString(),
  }));
  return { ...card, bio: def.bio, languages: def.languages, education: def.education, timezone: def.timezone, reviews };
}

export function fixtureSchedule(doctorKeyValue: string): Schedule | null {
  return SCHEDULES.find((s) => s.doctorKey === doctorKeyValue)?.schedule ?? null;
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
  imageUrl: storedImageUrl(medKey(d)),
  categoryIds: [],
}));

export function fixtureDoctorsByText(q: string): DoctorCard[] {
  const words = q.toLowerCase().split(' ').filter(Boolean);
  const keys = matchSpecialtyKeys(q);
  return doctorCards.filter((c) => words.every((w) => c.name.toLowerCase().includes(w)) || keys.includes(c.specialtyKey) || matchesClinic(c, words));
}

export function fixtureMedicinesByText(q: string): Medication[] {
  const words = q.toLowerCase().split(' ').filter(Boolean);
  return medicines.filter((m) => words.every((w) => m.name.toLowerCase().includes(w)));
}

export function fixtureMedicineBySku(sku: string): Medication | null {
  return medicines.find((m) => m.sku?.toLowerCase() === sku.toLowerCase()) ?? null;
}
