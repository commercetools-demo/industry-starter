import { getTranslations } from 'next-intl/server';
import ActiveFilters from '@/components/listing/ActiveFilters';
import AvailabilityChip from '@/components/listing/AvailabilityChip';
import Breadcrumbs from '@/components/listing/Breadcrumbs';
import EmptyState from '@/components/listing/EmptyState';
import FilterSheet from '@/components/listing/FilterSheet';
import FilterSidebar from '@/components/listing/FilterSidebar';
import ListingStoreSync from '@/components/listing/ListingStoreSync';
import Pagination from '@/components/listing/Pagination';
import ProductGrid from '@/components/listing/ProductGrid';
import ResultHeader from '@/components/listing/ResultHeader';
import SortSelect from '@/components/listing/SortSelect';
import { requestListing } from '@/lib/listing/request-listing';
import { itemsPerRow } from '@/lib/page-builder/authored';

/**
 * Category listing components of the page builder catalog (`listing/*`). The page builder decides where they sit and which are
 * there; what they show is the storefront's own listing, loaded once for the request (`requestListing`), so facets, counts,
 * prices and availability are exactly those of the native listing. Off a category page (or when the listing is not a normal
 * result) every one of them renders nothing.
 */

export async function ResultHeaderBlock() {
  const v = await requestListing();
  if (!v) return null;
  return <ResultHeader scope={v.scope} categoryName={v.category?.name} query={v.params.q} total={v.total} crumbs={v.crumbs} />;
}

export async function BreadcrumbsBlock() {
  const v = await requestListing();
  return v ? <Breadcrumbs items={v.crumbs} /> : null;
}

/** The filter sidebar (wide screens) and the Filters button with its sheet (narrow screens). */
export async function FacetsBlock() {
  const v = await requestListing();
  if (!v) return null;
  return (
    <>
      <FilterSidebar groups={v.groups} unavailable={v.facetsFailed} />
      <div className="mb-5 hidden max-stack:block">
        <FilterSheet groups={v.groups} params={v.params} scope={v.scope} basePath={v.basePath} apiScope={v.apiScope} total={v.total} activeCount={v.activeCount} />
      </div>
    </>
  );
}

/** Sort select, and the store availability chip where the market offers collection. */
export async function SortBlock() {
  const v = await requestListing();
  if (!v) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
      <AvailabilityChip active={v.params.avail} href={v.availHref} />
      <SortSelect value={v.params.sort} options={v.sortOptions} />
    </div>
  );
}

export async function ActiveFiltersBlock() {
  const v = await requestListing();
  return v ? <ActiveFilters chips={v.chips} clearAllHref={v.clearAllHref} /> : null;
}

export async function PaginationBlock() {
  const v = await requestListing();
  if (!v || v.total === 0) return null;
  return <Pagination page={v.page} pageCount={v.pageCount} basePath={v.basePath} params={v.params} scope={v.scope} />;
}

/** The results: a grid of the native product cards, or the native empty state when nothing matches. */
export async function ProductGridBlock({ data }: { data: { itemsPerRow?: string | number; showPrice?: boolean; showSwatches?: boolean } }) {
  const v = await requestListing();
  if (!v) return null;
  const t = await getTranslations('plp');
  return (
    <>
      <ListingStoreSync serverStoreKey={v.store?.key ?? null} />
      {v.total === 0 ? (
        <EmptyState clearAllHref={v.clearAllHref} />
      ) : (
        <>
          <h2 className="sr-only">{t('results')}</h2>
          <ProductGrid products={v.items} eagerFirst columns={itemsPerRow(data.itemsPerRow)} showPrice={data.showPrice ?? true} showSwatches={data.showSwatches ?? true} />
        </>
      )}
    </>
  );
}
