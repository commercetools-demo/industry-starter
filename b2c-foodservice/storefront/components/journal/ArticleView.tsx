import { useTranslations } from 'next-intl';
import Blocks from '@/components/content/Blocks';
import ContentPage from '@/components/content/ContentPage';
import FallbackNotice from '@/components/content/FallbackNotice';
import JsonLd from '@/components/content/JsonLd';
import ArticleCard from '@/components/journal/ArticleCard';
import { resolveLocalized } from '@/lib/content/localized';
import { relatedArticles } from '@/lib/content/journal';
import type { Article } from '@/lib/content/journal-types';
import { ARTICLES } from '@/content/journal';
import { journalHref } from '@/lib/routes';
import { siteOrigin } from '@/lib/content/seo';

/** A published article: breadcrumb, h1, date, tags, hero image, body, related block (omitted without a tag match). */
export default function ArticleView({ article, locale, all = ARTICLES }: { article: Article; locale: string; all?: Article[] }) {
  const t = useTranslations('journal');
  const title = resolveLocalized(article.title, locale);
  const body = resolveLocalized(article.body, locale);
  const description = resolveLocalized(article.description, locale);
  const isFallback = title.isFallback || body.isFallback;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${article.publishedAt}T00:00:00Z`));
  const related = relatedArticles(article, all);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title.value,
    description: description.value,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    inLanguage: body.usedLocale,
    mainEntityOfPage: `${siteOrigin()}/${locale}/journal/${article.slug}`,
    ...(article.image ? { image: article.image.url } : {}),
  };
  return (
    <ContentPage
      title={title.value}
      parents={[{ label: t('title'), href: journalHref() }]}
      banners={
        <>
          {isFallback ? <FallbackNotice locale={locale} /> : null}
          <p className="m-0 text-[14px] text-ink-2">
            <time dateTime={article.publishedAt}>{t('published', { date })}</time>
          </p>
          {article.tags.length > 0 ? (
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
              {article.tags.map((tag) => (
                <li key={tag} className="eyebrow">
                  {t(`tags.${tag}`)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      }
      contentLang={isFallback ? 'en' : undefined}
    >
      {article.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- images are resized at the image source, not by Next
        <img src={article.image.url} alt={resolveLocalized(article.image.alt, locale).value} fetchPriority="high" className="mb-8 aspect-[3/2] w-full rounded-card object-cover" />
      ) : null}
      <Blocks blocks={body.value} figures={{}} />
      {related.length > 0 ? (
        <section aria-labelledby="journal-related" className="mt-14">
          <h2 id="journal-related" className="section-title mb-5 text-[24px]!">
            {t('related')}
          </h2>
          <ul className="m-0 grid list-none gap-4 p-0">
            {related.map((r) => (
              <li key={r.slug}>
                <ArticleCard article={r} locale={locale} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <JsonLd data={jsonLd} />
    </ContentPage>
  );
}
