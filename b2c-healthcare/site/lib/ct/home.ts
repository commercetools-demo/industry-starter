import 'server-only';
import { unstable_cache } from 'next/cache';
import { listDoctors, type SearchDoctorsParams } from '@/lib/ct/doctors';
import { getShippingMethods } from '@/lib/ct/shipping';
import type { ConsultationMode, DoctorListItem } from '@/lib/types';

/** TTL (seconds) of the shared home snapshot: public data, so a short shared cache is allowed (design-home-page). */
export const HOME_REVALIDATE_SECONDS = 60;
export const HOME_DOCTOR_LIMIT = 3;

type Context = Pick<SearchDoctorsParams, 'locale' | 'currency' | 'country' | 'now'>;

/** A doctor for the home page with the mode whose fee and slot lead the card ("Video · $35"). */
export interface HomeDoctor {
  doctor: DoctorListItem;
  mode: ConsultationMode;
}

/** `today`: free slot today; `next`: nobody today, doctors with their next day; `none`: nobody (the section is hidden). */
export interface AvailableToday {
  state: 'today' | 'next' | 'none';
  items: HomeDoctor[];
}

/** A figure is null when it has no source (no doctors, no reviews, nobody free): the band then omits it. */
export interface HomeStats {
  doctorCount: number | null;
  /** Review-weighted average rating of all doctors, one decimal. */
  averageRating: number | null;
  /** Doctors with a bookable slot today (the booking lead time is 2 hours, so "now" would be a promise we cannot keep). */
  availableToday: number | null;
}

export interface HomeSnapshot {
  available: AvailableToday;
  stats: HomeStats;
}

export interface DoctorsByMode {
  remote: DoctorListItem[];
  office: DoctorListItem[];
}

async function loadDoctors(ctx: Context): Promise<DoctorsByMode> {
  const [remote, office] = await Promise.all(
    (['remote', 'office'] as const).map((mode) => listDoctors({ ...ctx, mode }).then((r) => r.items)),
  );
  return { remote: remote ?? [], office: office ?? [] };
}

const startOf = (d: DoctorListItem): number => (d.next ? Date.parse(d.next.startsAt) : Number.POSITIVE_INFINITY);

/** One entry per doctor. A slot today beats a later one; video wins a tie; otherwise the sooner slot leads. */
function leadEntries(by: DoctorsByMode): HomeDoctor[] {
  const office = new Map(by.office.map((d) => [d.key, d]));
  const entries: HomeDoctor[] = [];
  for (const remote of by.remote) {
    const other = office.get(remote.key);
    office.delete(remote.key);
    const useOffice = other !== undefined && ((other.next?.isToday ?? false) === (remote.next?.isToday ?? false) ? startOf(other) < startOf(remote) : other.next?.isToday === true);
    entries.push(useOffice && other ? { doctor: other, mode: 'office' } : { doctor: remote, mode: 'remote' });
  }
  for (const doctor of office.values()) entries.push({ doctor, mode: 'office' });
  return entries;
}

const bySoonest = (a: HomeDoctor, b: HomeDoctor) => startOf(a.doctor) - startOf(b.doctor) || a.doctor.name.localeCompare(b.doctor.name);

export function pickAvailableToday(by: DoctorsByMode, limit: number): AvailableToday {
  const withSlot = leadEntries(by)
    .filter((e) => e.doctor.next !== null)
    .sort(bySoonest);
  const today = withSlot.filter((e) => e.doctor.next?.isToday);
  if (today.length > 0) return { state: 'today', items: today.slice(0, limit) };
  if (withSlot.length > 0) return { state: 'next', items: withSlot.slice(0, limit) };
  return { state: 'none', items: [] };
}

export function computeStats(by: DoctorsByMode): HomeStats {
  const all = new Map<string, DoctorListItem>();
  for (const d of [...by.remote, ...by.office]) if (!all.has(d.key)) all.set(d.key, d);
  const doctors = [...all.values()];
  const rated = doctors.filter((d) => d.rating !== null && d.reviewCount > 0);
  const reviews = rated.reduce((sum, d) => sum + d.reviewCount, 0);
  const weighted = rated.reduce((sum, d) => sum + (d.rating ?? 0) * d.reviewCount, 0);
  const today = new Set([...by.remote, ...by.office].filter((d) => d.next?.isToday).map((d) => d.key));
  return {
    doctorCount: doctors.length > 0 ? doctors.length : null,
    averageRating: reviews > 0 ? Math.round((weighted / reviews) * 10) / 10 : null,
    availableToday: today.size > 0 ? today.size : null,
  };
}

/** Up to `limit` doctors with a free slot today; else the soonest next days; else nothing. Not cached. */
export async function getAvailableToday(limit: number, ctx: Context): Promise<AvailableToday> {
  return pickAvailableToday(await loadDoctors(ctx), limit);
}

/** Doctor count, average rating and doctors available today, from the catalog and the schedules. Not cached. */
export async function getHomeStats(ctx: Context): Promise<HomeStats> {
  return computeStats(await loadDoctors(ctx));
}

async function loadSnapshot(locale: string, currency: string, country: string): Promise<HomeSnapshot> {
  const by = await loadDoctors({ locale, currency, country });
  return { available: pickAvailableToday(by, HOME_DOCTOR_LIMIT), stats: computeStats(by) };
}

const cachedSnapshot = unstable_cache(loadSnapshot, ['home-snapshot'], { revalidate: HOME_REVALIDATE_SECONDS });

/** One shared read for the cards, the hero chip and the band (cached 60 s: public data). Null when the sources are down. */
export async function getHomeSnapshot(ctx: { locale: string; currency: string; country: string }): Promise<HomeSnapshot | null> {
  try {
    return await cachedSnapshot(ctx.locale, ctx.currency, ctx.country);
  } catch {
    return null;
  }
}

/** Whether a same-day shipping method is configured (D-014): the home page claims same-day delivery only then. */
export async function hasSameDayMethod(): Promise<boolean> {
  try {
    const methods = await getShippingMethods();
    return methods.some((m) => /same-day$/.test(m.key) && m.rates.length > 0);
  } catch {
    return false;
  }
}
