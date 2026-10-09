import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArticleCard } from '@/components/content/ArticleCard';
import { ContentNotes } from '@/components/content/ContentNotes';
import { StaticPage } from '@/components/content/StaticPage';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { categoriesOf, getPublishedArticles } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('static.journal');
  // The filtered listing shares the unfiltered canonical: articles are indexed at their own addresses.
  return pageMetadata({ locale, path: '/journal', title: t('title'), description: t('sub') });
}

const chip = 'rounded-sm border-thick px-3 py-1.5 font-display text-sm font-medium';

/** Health journal listing. The category filter is plain links (`?category=`), so it works without JavaScript. */
export default async function JournalPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations('static.journal');
  const category = typeof query.category === 'string' && query.category !== '' ? query.category : null;
  const all = getPublishedArticles(locale);
  const shown = category ? all.filter((article) => article.category === category) : all;
  const categories = categoriesOf(all);

  return (
    <StaticPage title={t('title')} sub={t('sub')}>
      <ContentNotes draft={all.some((article) => article.draft)} fellBack={all.some((article) => article.fellBack)} />
      {all.length === 0 ? <EmptyState title={t('empty')} /> : null}
      {categories.length > 0 ? (
        <nav aria-label={t('filterLabel')}>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <li>
              <Link
                href="/journal"
                aria-current={category === null ? 'true' : undefined}
                className={`${chip} ${category === null ? 'border-action bg-action text-action-label' : 'border-border bg-surface text-navy-900 hover:bg-brand-50'}`}
              >
                {t('all')}
              </Link>
            </li>
            {categories.map((name) => (
              <li key={name}>
                <Link
                  href={`/journal?category=${encodeURIComponent(name)}`}
                  aria-current={category === name ? 'true' : undefined}
                  className={`${chip} ${category === name ? 'border-action bg-action text-action-label' : 'border-border bg-surface text-navy-900 hover:bg-brand-50'}`}
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {category && shown.length === 0 ? (
        <EmptyState
          title={t('noMatch')}
          description={t('noMatchHint')}
          action={
            <>
              <Badge variant="neutral">{t('appliedFilter', { category })}</Badge>
              <ButtonLink href="/journal" variant="outline">
                {t('clearFilter')}
              </ButtonLink>
            </>
          }
        />
      ) : null}
      {shown.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : null}
    </StaticPage>
  );
}
