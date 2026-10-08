import 'server-only';
import { mapDoctorCard } from '@/lib/mappers/doctor';
import { zoneDate } from '@/lib/clinical/slots';
import { clampPage, cleanQuery, pageCountOf } from '@/lib/listing-url';
import { matchSpecialtyKeys } from '@/lib/specialties';
import { loadFixtures, type Fixtures } from '@/lib/ct/fixtures';
import { listFreeSlots, type Mode } from '@/lib/ct/scheduling';
import { searchProducts, type FacetResult } from '@/lib/ct/search';
import { buildNameMatch } from '@/lib/ct/search-query';
import type { ConsultationMode, DoctorAvailability, DoctorCard, DoctorListItem } from '@/lib/types';

export const DEFAULT_DOCTOR_PAGE_SIZE = 9;
/** Candidates evaluated for availability per request (the demo catalog is far below this). */
export const MAX_CANDIDATES = 50;
/** Days of availability looked at for the badge ("none if no slot in 7 days"). */
export const AVAILABILITY_DAYS = 7;

/** Page size (Q-031: 9). `DOCTOR_PAGE_SIZE` overrides it for testing the pager with few doctors. */
export function doctorPageSize(): number {
  const n = Number(process.env.DOCTOR_PAGE_SIZE);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : DEFAULT_DOCTOR_PAGE_SIZE;
}

export interface SearchDoctorsParams {
  mode: ConsultationMode;
  q?: string;
  specialty?: string;
  /** Office mode only; ignored for remote sessions. */
  city?: string;
  /** "Available today": next free slot is today in the clinic time zone. */
  today?: boolean;
  page?: number;
  locale: string;
  currency: string;
  country: string;
  /** Test hook; defaults to the current time. */
  now?: Date;
}

export interface DoctorSearchResult {
  items: DoctorListItem[];
  /** Doctors after every filter (including "Available today"). */
  total: number;
  /** The page returned (clamped to the last page with results). */
  page: number;
  pageCount: number;
  pageSize: number;
  /** Facets of the search (before the availability filter). */
  facets: FacetResult[];
}

/** Next free slot in the mode within 7 days; a doctor whose schedule cannot be read shows no badge. */
async function nextAvailability(doctorKey: string, mode: Mode, now: Date, fx: Fixtures | null): Promise<DoctorAvailability | null> {
  try {
    const slots = fx ? fx.fixtureAvailability(doctorKey, mode, now) : await listFreeSlots(doctorKey, mode, now, AVAILABILITY_DAYS);
    const slot = slots[0];
    if (!slot) return null;
    const t = zoneDate(slot.timezone, now.getTime());
    const todayLocal = `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
    return { startsAt: slot.startsAt, localDate: slot.localDate, isToday: slot.localDate === todayLocal };
  } catch {
    return null;
  }
}

/** Soonest availability first (no slot last), then rating (no rating last), then name. */
export function compareDoctors(a: DoctorListItem, b: DoctorListItem): number {
  const ta = a.next ? Date.parse(a.next.startsAt) : Number.POSITIVE_INFINITY;
  const tb = b.next ? Date.parse(b.next.startsAt) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ra = a.rating ?? -1;
  const rb = b.rating ?? -1;
  if (ra !== rb) return rb - ra;
  return a.name.localeCompare(b.name);
}

async function candidates(p: SearchDoctorsParams, q: string, fx: Fixtures | null): Promise<{ cards: DoctorCard[]; facets: FacetResult[] }> {
  const city = p.mode === 'office' ? p.city : undefined;
  if (fx) return fx.fixtureCandidates({ mode: p.mode, q, specialty: p.specialty, city });
  const options = { locale: p.locale, currency: p.currency };
  const page = await searchProducts(
    {
      locale: p.locale,
      currency: p.currency,
      country: p.country,
      extraQuery: q ? buildNameMatch(q, p.locale, specialtyMatch(q)) : undefined,
      filters: {
        modes: [p.mode],
        ...(p.specialty ? { specialty: [p.specialty] } : {}),
        ...(city ? { city: [city] } : {}),
      },
      sort: 'name-asc',
      page: 1,
      pageSize: MAX_CANDIDATES,
    },
    (projection) => mapDoctorCard(projection, options),
  );
  return { cards: page.items, facets: page.facets };
}

function specialtyMatch(q: string) {
  const keys = matchSpecialtyKeys(q);
  return keys.length > 0 ? [{ exact: { field: 'variants.attributes.specialty.key', fieldType: 'enum', values: keys } }] : [];
}

/**
 * The doctor list: Product Search narrows by mode, name/specialty text, specialty and city; availability is
 * then evaluated per candidate (it is not a catalog facet) so the card badge, the "Available today" filter and
 * the default order all use the same value. The fee is the price on the channel of the current mode.
 */
export async function searchDoctors(params: SearchDoctorsParams): Promise<DoctorSearchResult> {
  const now = params.now ?? new Date();
  const q = cleanQuery(params.q);
  const fx = await loadFixtures();
  const { cards, facets } = await candidates(params, q, fx);
  const withMode = cards.filter((c) => c.modes.includes(params.mode));
  const listed: DoctorListItem[] = await Promise.all(
    withMode.map(async (card) => ({ ...card, next: await nextAvailability(card.key, params.mode, now, fx) })),
  );
  const visible = (params.today ? listed.filter((d) => d.next?.isToday) : listed).sort(compareDoctors);
  const pageSize = doctorPageSize();
  const page = clampPage(params.page ?? 1, visible.length, pageSize);
  return {
    items: visible.slice((page - 1) * pageSize, page * pageSize),
    total: visible.length,
    page,
    pageCount: pageCountOf(visible.length, pageSize),
    pageSize,
    facets,
  };
}
