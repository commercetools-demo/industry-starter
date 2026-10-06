import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/Container';
import { Pagination } from '@/components/product/Pagination';
import { ProductGrid } from '@/components/product/ProductGrid';
import { SearchInput } from '@/components/search/SearchInput';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Link, redirect } from '@/i18n/routing';
import { DEFAULT_PAGE_SIZE, searchProducts } from '@/lib/ct/search';
import type { RawSearchParams } from '@/lib/listing-params';
import { parseSearchPage, parseSearchQuery } from '@/lib/search-query';
import { getMarket } from '@/lib/session';
import { COUNTRY_CONFIG } from '@/lib/utils';

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

/** The market follows the URL locale (D-012), like the shop page; the session only supplies a fallback. */
async function marketFor(locale: string) {
  const config = COUNTRY_CONFIG[locale];
  if (config) return { country: config.country, currency: config.currency, locale };
  return { ...(await getMarket()), locale };
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'search' });
  return { title: t('title') };
}

/** `?q=` and `?page=` are the whole state, so a shared link renders the results immediately. */
export default async function SearchPage({ params, searchParams }: PageProps) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'search' });
  const q = parseSearchQuery(sp.q);
  const page = parseSearchPage(sp.page);

  const result = q ? await searchProducts({ ...(await marketFor(locale)), text: q, page, pageSize: DEFAULT_PAGE_SIZE }) : undefined;

  const pageCount = result ? Math.ceil(result.total / result.pageSize) : 0;
  if (result && result.total > 0 && page > pageCount) {
    redirect({ href: `/search?${new URLSearchParams({ q, ...(pageCount > 1 ? { page: String(pageCount) } : {}) }).toString()}`, locale });
  }

  const suggestions = t.raw('suggestions') as string[];

  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <p className="mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{t('kicker')}</p>
      <h1 className="m-0 mb-(--space-6) text-[40px] leading-[1.05] tablet:text-[56px]">{t('title')}</h1>
      <SearchInput initialQuery={q} />
      {!result ? (
        <section aria-labelledby="search-suggestions" className="mt-(--space-6)">
          <h2 id="search-suggestions" className="m-0 mb-(--space-3) text-[14px] font-normal text-muted">
            {t('suggestionsLabel')}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-(--space-2) p-0">
            {suggestions.map((term) => (
              <li key={term}>
                <Link href={`/search?${new URLSearchParams({ q: term }).toString()}`} className="no-underline">
                  <Tag tone="outline">{term}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : result.products.length > 0 ? (
        <div className="mt-(--space-6)">
          <p role="status" className="m-0 mb-(--space-4) text-muted">
            {t('found', { count: result.total, query: q })}
          </p>
          <ProductGrid products={result.products} />
          <Pagination basePath="/search" params={{ q }} page={result.page} pageCount={pageCount} />
        </div>
      ) : (
        <section role="status" className="mx-auto flex max-w-[460px] flex-col items-center gap-(--space-3) py-(--space-8) text-center">
          <h2 className="m-0 text-[26px]">{t('none.title', { query: q })}</h2>
          <p className="m-0 text-muted">{t('none.body')}</p>
          <Button href="/shop" variant="secondary">
            {t('none.browse')}
          </Button>
        </section>
      )}
    </Container>
  );
}
