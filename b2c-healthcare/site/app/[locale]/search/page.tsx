import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DoctorCard } from '@/components/doctors/DoctorCard';
import { SpecialtyChips } from '@/components/doctors/SpecialtyChips';
import { MedicineResult } from '@/components/search/MedicineResult';
import { SearchForm } from '@/components/search/SearchForm';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHead } from '@/components/ui/PageHead';
import { searchAll, type SearchAllResult } from '@/lib/ct/search-all';
import { listingHref } from '@/lib/listing-url';
import { getSession } from '@/lib/session';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Search results are not indexable pages, and the query never leaves the URL: no logging, no analytics.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'search' });
  return { title: t('metaTitle'), robots: { index: false, follow: true } };
}

/** `/search?q=`: Doctors and Medicines groups, exact part number first, honest empty / unsupported / error states. */
export default async function SearchPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).q;
  const q = Array.isArray(raw) ? raw[0] : raw;
  const [t, session] = await Promise.all([getTranslations('search'), getSession()]);
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];

  let result: SearchAllResult | null;
  try {
    result = await searchAll({ q, locale, currency: session.currency ?? region.currency, country: session.country ?? region.country });
  } catch {
    result = null;
  }
  const searched = result && result.status !== 'empty-query' ? result.query : '';
  const typed = searched || (q ?? '').slice(0, 80);

  return (
    <>
      <PageHead title={t('title')}>
        <SearchForm defaultValue={typed} />
      </PageHead>
      <div className="mx-auto grid max-w-content gap-8 px-5 py-8 nav:px-8">
        <Body result={result} query={typed} />
      </div>
    </>
  );
}

function Body({ result, query }: { result: SearchAllResult | null; query: string }) {
  const t = useTranslations('search');
  const retry = useTranslations('doctors.error');
  if (result === null) {
    return (
      <EmptyState
        title={t('errorTitle')}
        description={t('errorDescription')}
        action={
          <ButtonLink href={query ? `/search?q=${encodeURIComponent(query)}` : '/search'} variant="outline">
            {retry('retry')}
          </ButtonLink>
        }
      />
    );
  }
  if (result.status === 'empty-query') {
    return (
      <EmptyState title={t('promptTitle')} description={t('promptDescription')} action={<SpecialtyChips mode="remote" />} />
    );
  }
  if (result.status === 'unsupported-language') {
    return <EmptyState title={t('unsupportedTitle')} description={t('unsupportedDescription')} />;
  }
  const { doctors, medicines, doctorTotal, medicineTotal, exact } = result;
  if (doctors.length === 0 && medicines.length === 0) {
    return (
      <EmptyState
        title={t('emptyTitle', { query: result.query })}
        description={t('emptyDescription')}
        action={<SpecialtyChips mode="remote" />}
      />
    );
  }
  return (
    <>
      <h2 className="font-display text-xl font-semibold text-navy-900">{t('resultsFor', { query: result.query })}</h2>
      {doctors.length > 0 ? (
        <section aria-labelledby="search-doctors" className="grid gap-4">
          <h3 id="search-doctors" className="font-display text-lg font-semibold text-navy-900">
            {t('doctors')} <span className="font-normal text-neutral-600">({t('doctorCount', { count: doctorTotal })})</span>
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0">
            {doctors.map((doctor) => (
              <li key={doctor.key}>
                <DoctorCard doctor={{ ...doctor, next: null }} mode={doctor.modes[0] ?? 'remote'} />
              </li>
            ))}
          </ul>
          <div>
            <ButtonLink href={listingHref('/doctors/remote', { q: result.query })} variant="outline" size="sm">
              {t('seeAllDoctors')}
            </ButtonLink>
          </div>
        </section>
      ) : null}
      {medicines.length > 0 ? (
        <section aria-labelledby="search-medicines" className="grid gap-4">
          <h3 id="search-medicines" className="font-display text-lg font-semibold text-navy-900">
            {t('medicines')} <span className="font-normal text-neutral-600">({t('medicineCount', { count: medicineTotal })})</span>
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0">
            {medicines.map((medicine) => (
              <li key={medicine.key}>
                <MedicineResult medicine={medicine} matchedSku={exact?.id === medicine.id} />
              </li>
            ))}
          </ul>
          <div>
            <ButtonLink href="/prescriptions" variant="outline" size="sm">
              {t('findRx')}
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </>
  );
}
