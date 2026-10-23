import { useTranslations } from 'next-intl';
import ActiveFilters from '@/components/listing/ActiveFilters';
import Breadcrumbs from '@/components/listing/Breadcrumbs';
import EmptyState from '@/components/listing/EmptyState';
import FilterSidebar from '@/components/listing/FilterSidebar';
import ListingStoreSync from '@/components/listing/ListingStoreSync';
import NoResults from '@/components/listing/NoResults';
import Pagination from '@/components/listing/Pagination';
import ProductGrid from '@/components/listing/ProductGrid';
import ResultHeader from '@/components/listing/ResultHeader';
import SearchInput from '@/components/listing/SearchInput';
import Toolbar from '@/components/listing/Toolbar';
import type { ListingResult } from '@/lib/listing/load';

/**
 * Render only: one layout for a category, "All products" and search. Never renders its own `<main>` (the layout does).
 * The redirect case is handled before this (see ListingRoute).
 */
export default function ListingPage({ result }: { result: Exclude<ListingResult, { kind: 'redirect' }> }) {
  const t = useTranslations('plp');
  if (result.kind === 'unsupported_language') {
    return (
      <div className="wrap py-16">
        <p role="alert" className="m-0 text-[16px] text-ink-2">{t('unsupportedLanguage')}</p>
      </div>
    );
  }
  if (result.kind === 'prompt') {
    return (
      <div className="wrap py-10">
        <SearchInput initialQuery="" otherParams="" autoFocus />
        <Breadcrumbs items={result.crumbs} />
        <p className="m-0 mt-8 text-[16px] text-ink-2">{t('search.prompt')}</p>
      </div>
    );
  }

  const { params, scope } = result;
  const noMatch = result.total === 0;
  return (
    <div className="wrap py-10">
      {scope === 'search' ? (
        <SearchInput initialQuery={params.q ?? ''} otherParams={result.otherParams} autoFocus={noMatch} />
      ) : null}
      <ResultHeader scope={scope} categoryName={result.category?.name} query={params.q} total={result.total} crumbs={result.crumbs} />
      <ListingStoreSync serverStoreKey={result.store?.key ?? null} />
      {noMatch && params.q && result.noResults && result.activeCount === 0 ? (
        <NoResults query={params.q} categories={result.noResults.categories} bestsellers={result.noResults.bestsellers} />
      ) : (
      <div className="grid gap-10 stack:grid-cols-[244px_minmax(0,1fr)]">
        <FilterSidebar groups={result.groups} unavailable={result.facetsFailed} />
        <div className="min-w-0">
          <Toolbar
            groups={result.groups}
            params={params}
            scope={scope}
            basePath={result.basePath}
            apiScope={result.apiScope}
            total={result.total}
            activeCount={result.activeCount}
            sortOptions={result.sortOptions}
            availHref={result.availHref}
          />
          <ActiveFilters chips={result.chips} clearAllHref={result.clearAllHref} />
          {!noMatch ? (
            <>
              <h2 className="sr-only">{t('results')}</h2>
              <ProductGrid products={result.items} eagerFirst />
              <Pagination page={result.page} pageCount={result.pageCount} basePath={result.basePath} params={params} scope={scope} />
            </>
          ) : params.q && result.noResults ? (
            <NoResults query={params.q} categories={result.noResults.categories} bestsellers={result.noResults.bestsellers} />
          ) : (
            <EmptyState clearAllHref={result.clearAllHref} />
          )}
        </div>
      </div>
      )}
    </div>
  );
}
