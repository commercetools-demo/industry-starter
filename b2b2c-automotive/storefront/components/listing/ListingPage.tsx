// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// One server-rendered listing for "All parts", a category and search results (workstream L). The three routes
// (`parts`, `category/[slug]`, `search`) render this component; their `generateMetadata` is `buildListingMetadata`.
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActiveFilters } from '@/components/listing/ActiveFilters';
import { FilterPanel, FilterSheet } from '@/components/listing/FilterPanel';
import { Pagination } from '@/components/listing/Pagination';
import { ProductGrid } from '@/components/listing/ProductGrid';
import { ResultHeader, type Crumb } from '@/components/listing/ResultHeader';
import { buttonClass } from '@/components/ui/Button';
import { Link, redirect } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import { basePathOf } from '@/lib/listing/metadata';
import { getListing, type ListingSurface, type ListingView } from '@/lib/listing/load';
import { listingHref } from '@/lib/search/params';
import type { FacetGroup } from '@/lib/types';

export interface ListingPageProps {
  locale: AppLocale;
  store: string;
  surface: ListingSurface;
  searchParams: Record<string, string | string[] | undefined>;
}

type FiltersT = Awaited<ReturnType<typeof getTranslations<'filters'>>>;

/** Group titles and the closed lists (quality, position) come from the catalogue so both languages read right. */
function localizeGroups(groups: FacetGroup[], t: FiltersT): FacetGroup[] {
  const own = (key: string) => (t.has(key as never) ? t(key as never) : undefined);
  return groups.map((g) => ({
    ...g,
    title: own(`group-${g.name}`) ?? g.title,
    options: g.name === 'brand' ? g.options : g.options.map((o) => ({ ...o, label: own(`${g.name === 'quality-tier' ? 'quality' : g.name}-${o.key}`) ?? o.label })),
  }));
}

export async function ListingPage({ locale, store, surface, searchParams }: ListingPageProps) {
  setRequestLocale(locale);
  const result = await getListing({ storeKey: store, locale, surface, searchParams });
  const basePath = basePathOf(store, surface);

  if (result.kind === 'not-found') notFound();
  if (result.kind === 'redirect') redirect({ href: listingHref(basePath, { ...result.params, page: result.page }), locale });

  const t = await getTranslations({ locale, namespace: 'listing' });
  if (result.kind === 'prompt') {
    return (
      <div className="mx-auto grid max-w-content gap-3 p-5">
        <h1 className="m-0 font-display text-3xl font-semibold text-text">{t('searchPromptTitle')}</h1>
        <p className="m-0 font-ui text-sm text-text-muted">{t('searchPromptBody')}</p>
      </div>
    );
  }
  if (result.kind !== 'ok') return null;

  const view: ListingView = result;
  const tf = await getTranslations({ locale, namespace: 'filters' });
  const groups = localizeGroups(view.groups, tf);
  const { params } = view;
  const title = view.category ? view.category.name : view.surface === 'search' ? t('searchTitle', { q: params.q ?? '' }) : t('allParts');
  const crumbs: Crumb[] = view.category ? view.category.ancestors.map((a) => ({ label: a.name, href: `/${store}/category/${a.slug}` })) : [];
  const withoutFit = listingHref(basePath, { ...params, fit: true, page: 1 });

  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <ResultHeader
        store={store}
        title={title}
        crumbs={crumbs}
        count={view.total}
        city={view.city}
        sort={view.sort}
        hasQuery={Boolean(params.q)}
        filterButton={<FilterSheet groups={groups} city={view.city} pickupAvailable={view.pickupAvailable} />}
      />
      <ActiveFilters params={params} basePath={basePath} groups={groups} city={view.city} />
      <div className="grid items-start gap-4 min-[64rem]:gap-5 min-[43.75rem]:grid-cols-[14.375rem_minmax(0,1fr)]">
        <FilterPanel groups={groups} city={view.city} pickupAvailable={view.pickupAvailable} />
        <section aria-label={t('resultsLabel')} className="min-w-0">
          {view.items.length > 0 ? (
            <>
              <ProductGrid items={view.items} label={t('resultsLabel')} store={store} city={view.city} shipDays={view.shipDays} alternativesHref={withoutFit} />
              <Pagination params={params} page={view.page} totalPages={view.totalPages} basePath={basePath} />
            </>
          ) : (
            <div className="grid justify-items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface p-7 text-center">
              <h2 className="m-0 font-display text-lg font-semibold text-text">{t('emptyTitle')}</h2>
              <p className="m-0 font-ui text-sm text-text-muted">{t('emptyBody')}</p>
              {view.fitScopeOn && view.vehicleLabel ? (
                <>
                  <p className="m-0 font-ui text-sm text-text-muted">{t('emptyFitBody', { vehicle: view.vehicleLabel })}</p>
                  <Link href={listingHref(basePath, { ...params, fit: false, page: 1 })} className={buttonClass('secondary')}>
                    {t('emptyFitLink')}
                  </Link>
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
