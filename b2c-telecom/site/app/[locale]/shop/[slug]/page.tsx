import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppliedFilters } from '@/components/offers/AppliedFilters';
import { FilterChips } from '@/components/offers/FilterChips';
import { ListingEmpty, type EmptyLink } from '@/components/offers/ListingEmpty';
import type { ListingCandidates } from '@/components/offers/ListingProvider';
import { OfferGrid } from '@/components/offers/OfferGrid';
import { Pagination } from '@/components/offers/Pagination';
import { ResultCount } from '@/components/offers/ResultCount';
import { SortSelect } from '@/components/offers/SortSelect';
import { TitleStrip, type SubcategoryLink } from '@/components/offers/TitleStrip';
import { UpsellBand } from '@/components/offers/UpsellBand';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { redirect } from '@/i18n/routing';
import { ADDONS_CATEGORY_KEY, BLURB_KEY_BY_CATEGORY, FOR_PARAM, PLAN_CATEGORY_BY_FAMILY } from '@/lib/config/listing';
import { SITE_URL } from '@/lib/config/site';
import { toDeviceOffers } from '@/lib/ct/devices';
import { toDateOnly } from '@/lib/pricing/dates';
import { breadcrumbTrail } from '@/lib/mappers/category';
import { countNounFor } from '@/lib/listing/kinds';
import { categoryPath } from '@/lib/listing/links';
import { buildListingMetadata } from '@/lib/listing/metadata';
import { toQueryString, withListingChange } from '@/lib/listing/params';
import { upsellNames } from '@/lib/listing/upsell';
import type { Locale } from '@/lib/types';
import { isSupportedLocale } from '@/lib/utils';
import { loadListing } from './loadListing';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The query string of the request as text (first value of every parameter): the key under which the listing is loaded once. */
function queryOf(raw: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) search.set(key, first);
  }
  return search.toString();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const loaded = await loadListing(locale, slug, queryOf(await searchParams));
  if (loaded.type !== 'ok') return {};
  const t = await getTranslations({ locale, namespace: 'plp' });
  const blurbKey = BLURB_KEY_BY_CATEGORY[loaded.category.key];
  return buildListingMetadata({
    locale,
    category: loaded.category,
    page: loaded.state.result.page,
    title: t('meta.title', { name: loaded.category.name }),
    description: blurbKey ? t(`blurb.${blurbKey}`) : t('meta.description', { name: loaded.category.name }),
    siteUrl: SITE_URL,
  });
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { locale: rawLocale, slug } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  setRequestLocale(locale);
  const raw = await searchParams;
  const loaded = await loadListing(locale, slug, queryOf(raw));
  if (loaded.type === 'not-found') notFound();
  if (loaded.type === 'redirect') redirect({ href: loaded.href, locale });
  if (loaded.type !== 'ok') notFound();

  const { category, tree, kind, params: listingParams, listed, pool, state, availability, postalCode } = loaded;
  const [t, tServiceability] = await Promise.all([getTranslations('plp'), getTranslations('serviceability')]);
  const basePath = `/shop/${category.slugs[locale] ?? category.slug}`;
  const { result, filter } = state;
  const noun = countNounFor(kind, listed);

  const trail = breadcrumbTrail(tree, category.key);
  const breadcrumb: BreadcrumbItem[] = [
    { label: t('home'), href: '/' },
    ...trail.slice(0, -1).map((ancestor) => ({ label: ancestor.name, href: `/shop/${ancestor.slugs[locale] ?? ancestor.slug}` })),
    { label: category.name },
  ];
  const subcategories: SubcategoryLink[] = category.children.map((child) => ({ key: child.key, name: child.name, href: `/shop/${child.slugs[locale] ?? child.slug}` }));
  const blurbKey = BLURB_KEY_BY_CATEGORY[category.key];
  const title = category.key === ADDONS_CATEGORY_KEY ? t('h1.addons') : category.name;

  let serviceNote: string | null = null;
  if (postalCode && availability.state === 'not-served') serviceNote = tServiceability('notServed', { postalCode });
  if (postalCode && availability.state === 'partially-served') {
    const technologies = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(availability.technologies.map((technology) => tServiceability(`tech.${technology}`)));
    serviceNote = tServiceability('partial', { postalCode, technologies });
  }

  const links = {
    addons: categoryPath(ADDONS_CATEGORY_KEY, locale, tree) ?? null,
    internetPlans: categoryPath(PLAN_CATEGORY_BY_FAMILY.internet, locale, tree) ?? null,
    phonePlans: categoryPath(PLAN_CATEGORY_BY_FAMILY.phone, locale, tree) ?? null,
  };
  const forParam = raw[FOR_PARAM];
  const preferred = typeof forParam === 'string' && /^[\w-]{1,64}$/.test(forParam) ? forParam : null;
  const candidates: ListingCandidates =
    kind === 'plans'
      ? { addons: pool.filter((offer) => offer.kind === 'addon'), equipment: pool.filter((offer) => offer.kind === 'equipment'), plans: [], preferredParentLineId: null, links }
      : kind === 'addons'
        ? { addons: [], equipment: [], plans: pool.filter((offer) => offer.kind === 'base-package' || offer.kind === 'bundle'), preferredParentLineId: preferred, links }
        : { addons: [], equipment: [], plans: [], preferredParentLineId: null, links };

  // Handsets: the offers of this page with their price per mode and term (policy ids resolved to keys), priced for the buyer's market.
  const devices = kind === 'devices' ? { offers: await toDeviceOffers(result.offers), today: toDateOnly(new Date()) } : undefined;

  const recovery: EmptyLink[] = tree
    .filter((root) => root.key !== category.key)
    .map((root) => ({ key: root.key, name: root.name, href: `/shop/${root.slugs[locale] ?? root.slug}` }));
  const keptQuery = Object.fromEntries(new URLSearchParams(toQueryString({ ...listingParams, filter, page: 1, offer: null })));

  return (
    <>
      <TitleStrip
        breadcrumb={breadcrumb}
        title={title}
        blurb={blurbKey ? t(`blurb.${blurbKey}`) : undefined}
        subcategories={subcategories}
        note={serviceNote ? <p role="note" className="m-0 font-display text-md font-semibold text-brand-950">{serviceNote}</p> : null}
      />
      <section aria-label={title} className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 pb-16 pt-8 md:px-10">
        {result.empty === 'no-offers' ? (
          <ListingEmpty variant="empty" links={recovery} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <FilterChips chips={result.chips} active={filter} params={{ ...listingParams, filter }} basePath={basePath} />
              <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-5 md:w-auto md:justify-end">
                {listed.length >= 2 ? <SortSelect params={{ ...listingParams, filter }} /> : null}
                <ResultCount noun={noun} count={result.total} />
              </div>
            </div>
            <AppliedFilters filter={filter} params={listingParams} basePath={basePath} />
            {result.empty === 'no-match' ? (
              <ListingEmpty variant="no-match" noun={noun} clearHref={`${basePath}${toQueryString(withListingChange(listingParams, { filter: null }))}`} />
            ) : (
              <OfferGrid kind={kind} offers={result.offers} highlightKey={state.highlightKey} candidates={candidates} devices={devices} />
            )}
            <Pagination page={result.page} pageCount={result.pageCount} basePath={basePath} query={keptQuery} />
          </>
        )}
        {kind === 'plans' ? <UpsellBand names={upsellNames(candidates.addons)} href={links.addons} /> : null}
      </section>
    </>
  );
}
