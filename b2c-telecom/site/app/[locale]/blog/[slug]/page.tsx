import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { JsonLd } from '@/components/content/JsonLd';
import { PAGE_COLUMN, PAGE_FRAME, PAGE_TITLE } from '@/components/content/prose';
import { TagLinks } from '@/components/content/TagLinks';
import { Link } from '@/i18n/routing';
import { availableLocales, getArticle, getRelated, listArticles } from '@/lib/content/blog';
import { formatDate } from '@/lib/content/format';
import { articleJsonLd } from '@/lib/content/jsonld';
import { absoluteUrl } from '@/lib/content/metadata';
import { FALLBACK_LOCALE } from '@/lib/content/types';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => listArticles(locale).articles.map((article) => ({ locale, slug: article.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const result = getArticle(slug, locale);
  if (!result) return {};
  if (result.kind === 'withdrawn') {
    const t = await getTranslations({ locale, namespace: 'content.blog' });
    return { title: t('withdrawnTitle'), robots: { index: false, follow: true } };
  }
  const { article } = result;
  const path = `/blog/${slug}`;
  const canonical = absoluteUrl(article.fallback ? FALLBACK_LOCALE : locale, path);
  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical,
      languages: Object.fromEntries(availableLocales(slug).map((l) => [l, absoluteUrl(l, path)])),
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url: canonical,
      locale: locale.replace('-', '_'),
      publishedTime: article.date,
      modifiedTime: article.updated ?? article.date,
    },
    ...(article.fallback ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const result = getArticle(slug, locale);
  if (!result) notFound();
  const t = await getTranslations({ locale, namespace: 'content.blog' });

  if (result.kind === 'withdrawn') {
    const tags = await getTranslations({ locale, namespace: 'content.tags' });
    const topic = tags.has(result.topic) ? tags(result.topic) : result.topic;
    return (
      <div className={PAGE_FRAME}>
        <div className={PAGE_COLUMN}>
          <h1 className={`m-0 ${PAGE_TITLE}`}>{t('withdrawnTitle')}</h1>
          <p className="mt-5 font-body text-md">
            <Link href={{ pathname: '/blog', query: { tag: result.topic } }} className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4">
              {t('withdrawnLink', { topic })}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { article } = result;
  const related = getRelated(article, locale);
  const canonical = absoluteUrl(article.fallback ? FALLBACK_LOCALE : locale, `/blog/${slug}`);
  return (
    <ContentArticle
      doc={{ title: article.title, html: article.html, fallback: article.fallback }}
      intro={
        <div className="mt-4 flex flex-col gap-4">
          <p className="m-0 font-body text-sm text-text-muted">{t('publishedOn', { date: formatDate(article.date, locale) })}</p>
          <TagLinks tags={article.tags} />
        </div>
      }
    >
      {related.length > 0 ? (
        <section aria-labelledby="related-articles" className="mt-9">
          <h2 id="related-articles" className="m-0 mb-3 font-display text-xl font-semibold text-brand-950">
            {t('related')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={`/blog/${other.slug}`} className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4">
                  {other.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <JsonLd data={articleJsonLd(article, canonical)} />
    </ContentArticle>
  );
}
