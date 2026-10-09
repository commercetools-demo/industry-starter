import 'server-only';
import { cleanQuery } from '@/lib/listing-url';
import { mapDoctorCard } from '@/lib/mappers/doctor';
import { mapMedication } from '@/lib/mappers/medication';
import { matchSpecialtyKeys } from '@/lib/specialties';
import { loadFixtures } from '@/lib/ct/fixtures';
import { searchProducts } from '@/lib/ct/search';
import { buildClinicMatch, buildNameMatch, type Query } from '@/lib/ct/search-query';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';
import type { DoctorCard, Medication } from '@/lib/types';

/** Results shown per group on the search page. */
export const SEARCH_GROUP_SIZE = 8;

export type SearchAllResult =
  | { status: 'empty-query' }
  | { status: 'unsupported-language'; query: string }
  | {
      status: 'ok';
      /** The sanitised query (what was actually searched). */
      query: string;
      doctors: DoctorCard[];
      doctorTotal: number;
      /** Medicines, the exact part-number match (if any) first and not repeated. */
      medicines: Medication[];
      medicineTotal: number;
      /** The medicine whose SKU equals the query exactly. */
      exact: Medication | null;
    };

/**
 * Query as typed -> query as searched: control characters and markup-ish punctuation become spaces, runs of
 * spaces collapse, the length is capped. Letters of any script, digits and `. , - / ' + %` survive.
 */
export function sanitizeQuery(raw: string | undefined): string {
  return cleanQuery((raw ?? '').replace(/[^\p{L}\p{N}\s.,\-/'+%]/gu, ' '));
}

const SCRIPT_BY_LANGUAGE: Record<string, RegExp> = { en: /\p{Script=Latin}/u };

/**
 * Product Search only answers in the languages configured for the project; a query in another script would
 * come back empty, which looks like "no matches". A query is unsupported when it has letters and none of them
 * belongs to the script of the storefront language.
 */
export function isSupportedQueryLanguage(query: string, locale: string): boolean {
  const language = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE].language;
  const script = SCRIPT_BY_LANGUAGE[language];
  if (!script || !/\p{L}/u.test(query)) return true;
  return script.test(query);
}

/** A part number has no spaces and mixes letters with digits or dashes ("MED-ibuprofen-400-mg", "RX123"). */
export function looksLikePartNumber(query: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{2,63}$/.test(query) && /[0-9-]/.test(query);
}

/** Medicines are the products with the `rxOnly` attribute; doctors never have it. */
const MEDICINES_ONLY = {
  or: [
    { exact: { field: 'variants.attributes.rxOnly', fieldType: 'boolean', value: true } },
    { exact: { field: 'variants.attributes.rxOnly', fieldType: 'boolean', value: false } },
  ],
} as Query;

const and = (...parts: Query[]): Query => ({ and: parts }) as Query;

/**
 * Doctors (name, specialty) and medicines (name) for one query, plus the exact SKU resolution: a query equal to
 * a medicine SKU puts that medicine first. Typo tolerance is the platform's fuzzy matching on the name; there
 * is no "did you mean" correction (not provided by commercetools). The query text is never logged.
 */
export async function searchAll(params: { q: string | undefined; locale: string; currency: string; country: string }): Promise<SearchAllResult> {
  const query = sanitizeQuery(params.q);
  if (!query) return { status: 'empty-query' };
  if (!isSupportedQueryLanguage(query, params.locale)) return { status: 'unsupported-language', query };

  const fx = await loadFixtures();
  if (fx) {
    const exact = looksLikePartNumber(query) ? fx.fixtureMedicineBySku(query) : null;
    const doctors = fx.fixtureDoctorsByText(query);
    const meds = fx.fixtureMedicinesByText(query).filter((m) => m.id !== exact?.id);
    return {
      status: 'ok',
      query,
      doctors: doctors.slice(0, SEARCH_GROUP_SIZE),
      doctorTotal: doctors.length,
      medicines: [...(exact ? [exact] : []), ...meds].slice(0, SEARCH_GROUP_SIZE),
      medicineTotal: meds.length + (exact ? 1 : 0),
      exact,
    };
  }

  const { locale, currency, country } = params;
  const base = { locale, currency, country, page: 1, pageSize: SEARCH_GROUP_SIZE };
  const specialtyKeys = matchSpecialtyKeys(query);
  const specialtyMatch: Query[] =
    specialtyKeys.length > 0 ? [{ exact: { field: 'variants.attributes.specialty.key', fieldType: 'enum', values: specialtyKeys } } as Query] : [];

  const [doctors, medicines, exact] = await Promise.all([
    searchProducts(
      { ...base, extraQuery: buildNameMatch(query, locale, [...specialtyMatch, buildClinicMatch(query)]), filters: { modes: ['remote', 'office'] }, sort: 'name-asc' },
      (projection) => mapDoctorCard(projection, { locale, currency }),
    ),
    searchProducts({ ...base, extraQuery: and(MEDICINES_ONLY, buildNameMatch(query, locale)) }, (projection) => mapMedication(projection, { locale, currency })),
    looksLikePartNumber(query)
      ? searchProducts(
          { ...base, pageSize: 1, extraQuery: and(MEDICINES_ONLY, { exact: { field: 'variants.sku', value: query, caseInsensitive: true } } as Query) },
          (projection) => mapMedication(projection, { locale, currency }),
        )
      : Promise.resolve(null),
  ]);

  const exactMatch = exact?.items.find((m) => m.sku?.toLowerCase() === query.toLowerCase()) ?? null;
  const rest = medicines.items.filter((m) => m.id !== exactMatch?.id);
  return {
    status: 'ok',
    query,
    doctors: doctors.items,
    doctorTotal: doctors.total,
    medicines: exactMatch ? [exactMatch, ...rest] : rest,
    medicineTotal: medicines.total + (exactMatch && !medicines.items.some((m) => m.id === exactMatch.id) ? 1 : 0),
    exact: exactMatch,
  };
}
