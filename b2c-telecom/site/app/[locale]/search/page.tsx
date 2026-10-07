import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Pagination } from '@/components/offers/Pagination';
import { CategoryChips } from '@/components/search/CategoryChips';
import { NoResults } from '@/components/search/NoResults';
import { ResultsHeader } from '@/components/search/ResultsHeader';
import { SearchError } from '@/components/search/SearchError';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { SearchTitleStrip } from '@/components/search/SearchTitleStrip';
import { StartState } from '@/components/search/StartState';
import { UnsupportedLanguage } from '@/components/search/UnsupportedLanguage';
import { loadSearch } from '@/lib/search/load';
import { normalizeQuery, toSearchQueryString, type RawSearchParams } from '@/lib/search/params';
import { resolveFallbackTiles } from '@/lib/search/tiles';
import type { Locale } from '@/lib/types';
import { isSupportedLocale } from '@/lib/utils';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const raw = (await searchParams).q;
  const q = normalizeQuery((Array.isArray(raw) ? raw[0] : raw) ?? '');
  const t = await getTranslations({ locale, namespace: 'search.meta' });
  // Internal search results are not for search engines.
  return { title: q === '' ? t('title') : t('titleQuery', { query: q }), robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  setRequestLocale(locale);
  const { params: query, view, tree } = await loadSearch(locale, await searchParams);
  const t = await getTranslations('search');
  const tiles = resolveFallbackTiles(tree, locale);
  const retryHref = `/search${toSearchQueryString(query)}`;
  const kept = Object.fromEntries(new URLSearchParams(toSearchQueryString({ ...query, page: 1 })));

  return (
    <>
      <SearchTitleStrip q={view.query} />
      <section aria-label={t('title')} className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 pb-16 pt-8 md:px-10">
        {view.state === 'start' ? <StartState hint={view.query !== ''} tiles={tiles} /> : null}
        {view.state === 'unsupported-language' ? <UnsupportedLanguage /> : null}
        {view.state === 'error' ? <SearchError retryHref={retryHref} /> : null}
        {view.state === 'none' ? <NoResults query={view.query} tiles={tiles} /> : null}
        {view.state === 'results' ? (
          <>
            <ResultsHeader count={view.total} query={view.query} params={query} />
            <CategoryChips categories={view.categories} total={view.categories.reduce((sum, category) => sum + category.count, 0)} params={query} />
            {view.truncated ? (
              <p role="note" className="m-0 text-sm text-text-muted">
                {t('truncated')}
              </p>
            ) : null}
            <ul className="m-0 grid list-none grid-cols-1 gap-7 p-0 md:grid-cols-2 lg:grid-cols-3">
              {view.items.map((item, index) => (
                <SearchResultCard key={item.offerKey} item={item} best={view.page === 1 && index === 0} />
              ))}
            </ul>
            <Pagination page={view.page} pageCount={view.pageCount} basePath="/search" query={kept} />
          </>
        ) : null}
      </section>
    </>
  );
}
