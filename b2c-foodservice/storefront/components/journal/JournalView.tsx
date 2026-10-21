import { useTranslations } from 'next-intl';
import ContentPage from '@/components/content/ContentPage';
import FallbackNotice from '@/components/content/FallbackNotice';
import ArticleCard from '@/components/journal/ArticleCard';
import { Link } from '@/i18n/routing';
import { ARTICLES } from '@/content/journal';
import { resolveLocalized } from '@/lib/content/localized';
import { filterArticles, paginate, type JournalQuery } from '@/lib/content/journal';
import { JOURNAL_TAGS, type Article, type JournalTag } from '@/lib/content/journal-types';
import { journalHref } from '@/lib/routes';

const CHIP = 'transition-state inline-flex min-h-9 items-center rounded-pill border px-4 py-[7px] text-[13px] font-medium';
const CHIP_ON = `${CHIP} border-ink bg-ink text-surface`;
const CHIP_OFF = `${CHIP} border-line-2 bg-surface text-ink hover:border-ink`;

/** Journal listing. Filters live in the URL: `?tag=brewing&tag=capsules&q=descale&page=2`. */
export default function JournalView({
  locale,
  query,
  articles = ARTICLES,
}: {
  locale: string;
  query: JournalQuery;
  articles?: Article[];
}) {
  const t = useTranslations('journal');
  const matches = filterArticles(query, locale, articles);
  const { items, page, totalPages } = paginate(matches, query.page);
  const anyFallback = items.some((a) => resolveLocalized(a.title, locale).isFallback);
  const hasFilters = query.tags.length > 0 || query.q !== '';
  const toggle = (tag: JournalTag): JournalTag[] => (query.tags.includes(tag) ? query.tags.filter((x) => x !== tag) : [...query.tags, tag]);

  return (
    <ContentPage title={t('title')} intro={t('intro')} wide banners={anyFallback ? <FallbackNotice locale={locale} /> : null}>
      <nav aria-label={t('filters')}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {JOURNAL_TAGS.map((tag) => {
            const active = query.tags.includes(tag);
            return (
              <li key={tag}>
                <Link href={journalHref({ tags: toggle(tag), q: query.q })} aria-current={active ? 'true' : undefined} className={active ? CHIP_ON : CHIP_OFF}>
                  {t(`tags.${tag}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form role="search" method="get" action={`/${locale}/journal`} className="my-6 flex max-w-[520px] gap-2">
        {query.tags.map((tag) => (
          <input key={tag} type="hidden" name="tag" value={tag} />
        ))}
        <label htmlFor="journal-q" className="sr-only">
          {t('search')}
        </label>
        <input
          id="journal-q"
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder={t('search')}
          className="min-h-11 w-full rounded-pill border border-line-2 bg-surface px-4 text-[14px] outline-none focus:border-accent focus:ring-3 focus:ring-ring"
        />
        <button type="submit" className="min-h-11 cursor-pointer rounded-pill bg-ink px-5 text-[14px] font-semibold text-surface">
          {t('searchSubmit')}
        </button>
      </form>

      {hasFilters ? (
        <div className="mb-6" aria-label={t('applied')} role="group">
          <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            {query.tags.map((tag) => (
              <li key={tag}>
                <Link href={journalHref({ tags: query.tags.filter((x) => x !== tag), q: query.q })} aria-label={t('removeFilter', { label: t(`tags.${tag}`) })} className={CHIP_ON}>
                  {t(`tags.${tag}`)} <span aria-hidden="true">&times;</span>
                </Link>
              </li>
            ))}
            {query.q ? (
              <li>
                <Link href={journalHref({ tags: query.tags })} aria-label={t('removeFilter', { label: query.q })} className={CHIP_ON}>
                  {t('searchChip', { query: query.q })} <span aria-hidden="true">&times;</span>
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={journalHref()} className="text-[13px] underline underline-offset-2 hover:text-accent">
                {t('clear')}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      {matches.length === 0 ? (
        <p role="status" className="my-8 text-[17px] text-ink-2">
          {t('empty')}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 xs:grid-cols-2 grid3:grid-cols-3">
          {items.map((article) => (
            <li key={article.slug}>
              <ArticleCard article={article} locale={locale} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label={t('pagination')} className="mt-10 flex items-center justify-center gap-4 text-[14px]">
          {page > 1 ? (
            <Link rel="prev" href={journalHref({ tags: query.tags, q: query.q, page: page - 1 })} className="underline underline-offset-2 hover:text-accent">
              {t('previous')}
            </Link>
          ) : null}
          <span>{t('pageOf', { page, total: totalPages })}</span>
          {page < totalPages ? (
            <Link rel="next" href={journalHref({ tags: query.tags, q: query.q, page: page + 1 })} className="underline underline-offset-2 hover:text-accent">
              {t('next')}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </ContentPage>
  );
}
