import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppliedFilters } from '@/components/product/AppliedFilters';
import { Breadcrumbs } from '@/components/product/Breadcrumbs';
import { FilterRail } from '@/components/product/FilterRail';
import { FiltersSheet } from '@/components/product/FiltersSheet';
import { ListingEmpty } from '@/components/product/ListingEmpty';
import { ListingToolbar } from '@/components/product/ListingToolbar';
import { Pagination } from '@/components/product/Pagination';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Container } from '@/components/layout/Container';
import { redirect } from '@/i18n/routing';
import { getCategoryTree } from '@/lib/ct/categories';
import { loadListing } from '@/lib/ct/listing';
import { DEFAULT_PAGE_SIZE } from '@/lib/ct/search';
import { listingHref, parseListingParams, toQueryString, type RawSearchParams } from '@/lib/listing-params';
import { buildFilterData, findCategoryBySlug } from '@/lib/listing-view';
import { getMarket } from '@/lib/session';
import type { Category } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

/** The market follows the URL locale (D-012: one market per locale); the session only supplies a fallback. */
async function marketFor(locale: string) {
  const config = COUNTRY_CONFIG[locale];
  if (config) return { country: config.country, currency: config.currency, locale };
  return { ...(await getMarket()), locale };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const [t, tree] = await Promise.all([getTranslations({ locale, namespace: 'nav' }), getCategoryTree(locale)]);
  const { category: slug } = parseListingParams(sp);
  const category = slug ? findCategoryBySlug(tree, slug) : undefined;
  return { title: category?.name ?? t('shop') };
}

/**
 * Server-rendered listing. The category tree and the product search start together; only a `category` slug has to wait
 * for the (cached) tree because the search needs the category id.
 */
export default async function ShopPage({ params, searchParams }: PageProps) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const [market, t] = await Promise.all([marketFor(locale), getTranslations({ locale, namespace: 'plp' })]);
  const listingParams = parseListingParams(sp);

  const treePromise = getCategoryTree(locale);
  const search = (categoryId?: string) =>
    loadListing({
      ...market,
      categoryId,
      priceBand: listingParams.price,
      availability: listingParams.stock === 'in' ? 'in-stock' : listingParams.stock === 'out' ? 'out-of-stock' : undefined,
      sort: listingParams.sort,
      page: listingParams.page,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  const resolvedCategory = (tree: Category[]) => (listingParams.category ? findCategoryBySlug(tree, listingParams.category) : undefined);
  const listingPromise = listingParams.category ? treePromise.then((tree) => search(resolvedCategory(tree)?.id)) : search();
  const [tree, listing] = await Promise.all([treePromise, listingPromise]);

  const category = resolvedCategory(tree);
  // An unknown slug is ignored: the rail and links behave as if it was absent.
  const { category: _requested, ...others } = listingParams;
  void _requested;
  const effective = { ...others, ...(category ? { category: category.slug } : {}) };

  const pageCount = Math.ceil(listing.total / listing.pageSize);
  if (listing.total > 0 && listingParams.page > pageCount) redirect({ href: listingHref({ ...effective, page: pageCount }), locale });

  const filters = buildFilterData({ tree, facets: listing.facets, categoryTotal: listing.categoryTotal, currency: market.currency });
  // Everything except `page`, for the pagination links.
  const preserved = Object.fromEntries(new URLSearchParams(toQueryString({ ...effective, page: 1 })));

  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <Breadcrumbs category={category?.name} />
      <p className="mt-(--space-4) mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{t('kicker')}</p>
      <h1 className="m-0 text-[40px] leading-[1.05] tablet:text-[56px]">{category?.name ?? t('everything')}</h1>
      <div className="mt-(--space-8) grid items-start gap-(--space-8) desktop:grid-cols-[230px_1fr]">
        <aside className="hidden desktop:sticky desktop:top-[110px] desktop:block">
          <FilterRail data={filters} params={effective} />
        </aside>
        <div className="min-w-0">
          <FiltersSheet data={filters} params={effective} className="mb-(--space-4) desktop:hidden" />
          <ListingToolbar total={listing.total} params={effective} />
          <AppliedFilters data={filters} params={effective} />
          {listing.products.length > 0 ? <ProductGrid products={listing.products} /> : <ListingEmpty />}
          <Pagination basePath="/shop" params={preserved} page={listing.page} pageCount={pageCount} />
        </div>
      </div>
    </Container>
  );
}
