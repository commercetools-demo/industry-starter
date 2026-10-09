import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActiveFilters, DoctorList } from '@/components/doctors/DoctorList';
import { SpecialtyChips } from '@/components/doctors/SpecialtyChips';
import { DoctorFilters } from '@/components/doctors/DoctorFilters';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHead } from '@/components/ui/PageHead';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { redirect } from '@/i18n/routing';
import { searchDoctors, type DoctorSearchResult } from '@/lib/ct/doctors';
import { listingHref, parseListingState } from '@/lib/listing-url';
import { pageMetadata } from '@/lib/seo';
import { getSession } from '@/lib/session';
import type { ConsultationMode } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Params = Promise<{ locale: string; mode: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const isMode = (value: string): value is ConsultationMode => value === 'remote' || value === 'office';

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, mode } = await params;
  if (!isMode(mode)) return {};
  const t = await getTranslations({ locale, namespace: 'doctors' });
  return pageMetadata({ locale, path: `/doctors/${mode}`, title: t(`${mode}.metaTitle`), description: t(`${mode}.sub`) });
}

/**
 * Doctor list (design-plp). Server-rendered: the whole listing state is in the URL, so the same URL gives the
 * same list. Only `remote` and `office` exist; any other segment is a 404. The filter options are static
 * (lib/specialties.ts), availability is evaluated per request (never cached).
 */
export default async function DoctorsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, mode } = await params;
  if (!isMode(mode)) notFound();
  setRequestLocale(locale);
  const state = parseListingState(await searchParams);
  const [t, session] = await Promise.all([getTranslations('doctors'), getSession()]);
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  const path = `/doctors/${mode}`;

  let result: DoctorSearchResult | null = null;
  try {
    result = await searchDoctors({
      mode,
      q: state.q,
      specialty: state.specialty || undefined,
      city: state.city || undefined,
      today: state.today,
      page: state.page,
      locale,
      currency: session.currency ?? region.currency,
      country: session.country ?? region.country,
    });
  } catch {
    // Search is down: say so (below) instead of a blank page. No query text is logged (health-data rule).
    result = null;
  }
  // A page past the last result goes to the last page that has results (the URL says what is shown).
  if (result && state.page > result.page) redirect({ href: listingHref(path, { ...state, page: result.page }), locale });

  const itemsHref = (page: number) => listingHref(path, { ...state, page });
  return (
    <>
      <PageHead title={t(`${mode}.title`)} sub={t(`${mode}.sub`)}>
        <SegmentedControl
          className="mt-5"
          label={t('mode.label')}
          value={mode}
          items={[
            { value: 'remote', label: t('mode.remote'), href: listingHref('/doctors/remote', { ...state, page: 1 }) },
            { value: 'office', label: t('mode.office'), href: listingHref('/doctors/office', { ...state, page: 1 }) },
          ]}
        />
      </PageHead>
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <DoctorFilters mode={mode} state={state} />
        <SpecialtyChips mode={mode} selected={state.specialty} className="mt-4" />
        <div className="mt-3">
          <ActiveFilters mode={mode} state={state} />
        </div>
        {result ? (
          <>
            <p data-testid="doctor-count" className="mt-6 mb-4 text-sm text-neutral-600">
              {t('count', { count: result.total })}
            </p>
            <DoctorList items={result.items} mode={mode} state={state} />
            <Pagination page={result.page} pageCount={result.pageCount} hrefFor={itemsHref} className="mt-8" />
          </>
        ) : (
          <EmptyState
            className="mt-8"
            title={t('error.title')}
            description={t('error.description')}
            action={
              <ButtonLink href={listingHref(path, state)} variant="outline">
                {t('error.retry')}
              </ButtonLink>
            }
          />
        )}
      </div>
    </>
  );
}
