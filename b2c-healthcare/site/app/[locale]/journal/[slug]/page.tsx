import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/content/ArticleCard';
import { ArticleCover } from '@/components/content/ArticleCover';
import { ContentNotes } from '@/components/content/ContentNotes';
import { Markdown } from '@/components/content/Markdown';
import { StaticPage } from '@/components/content/StaticPage';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DEFAULT_LOCALE } from '@/lib/utils';
import { getArticle, getArticles, getRelatedArticles } from '@/lib/content';
import { formatIsoDate } from '@/lib/format-date';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  // Withdrawn articles are included on purpose: their address answers with the "no longer available" page.
  return getArticles(DEFAULT_LOCALE).map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticle(slug, locale);
  if (!article) return {};
  const path = `/journal/${slug}`;
  if (article.withdrawn) {
    const t = await getTranslations('static.journal');
    return pageMetadata({ locale, path, title: t('withdrawnTitle'), noindex: true });
  }
  return pageMetadata({ locale, path, title: article.title, description: article.description });
}

/** One article at its own stable address; a withdrawn one never serves its text and points back to its topic. */
export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = getArticle(slug, locale);
  if (!article) notFound();
  const t = await getTranslations('static.journal');

  if (article.withdrawn) {
    return (
      <StaticPage title={t('withdrawnTitle')} sub={t('withdrawnBody')}>
        <div className="flex flex-wrap gap-3">
          {article.category ? (
            <ButtonLink href={`/journal?category=${encodeURIComponent(article.category)}`}>{t('moreIn', { category: article.category })}</ButtonLink>
          ) : null}
          <ButtonLink href="/journal" variant="outline">
            {t('backToJournal')}
          </ButtonLink>
        </div>
      </StaticPage>
    );
  }

  const related = getRelatedArticles(article, locale);
  return (
    <StaticPage title={article.title} sub={article.description}>
      <ContentNotes draft={article.draft} fellBack={article.fellBack} />
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Badge variant="info">{article.category}</Badge>
        <span>{t('minutes', { count: article.minutes })}</span>
        {article.published ? <time dateTime={article.published}>{t('publishedOn', { date: formatIsoDate(article.published, locale) })}</time> : null}
      </div>
      <ArticleCover className="max-w-180" />
      <Markdown source={article.body} />
      {related.length > 0 ? (
        <section aria-labelledby="related" className="grid gap-4">
          <h2 id="related" className="font-display text-2xl font-semibold text-navy-900">
            {t('related')}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ArticleCard key={item.slug} article={item} />
            ))}
          </div>
        </section>
      ) : null}
      <div>
        <ButtonLink href="/journal" variant="outline">
          {t('backToJournal')}
        </ButtonLink>
      </div>
    </StaticPage>
  );
}
