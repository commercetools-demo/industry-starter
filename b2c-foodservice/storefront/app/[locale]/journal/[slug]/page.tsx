import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import ArticleView from '@/components/journal/ArticleView';
import { ARTICLES } from '@/content/journal';
import { redirect, routing } from '@/i18n/routing';
import { getArticle, ownLocalesOf, publishedArticles } from '@/lib/content/journal';
import { resolveLocalized } from '@/lib/content/localized';
import { pageMetadata } from '@/lib/content/seo';
import { articleHref, journalHref } from '@/lib/routes';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Published articles for every locale; withdrawn and unknown slugs are handled per request (dynamicParams stays true). */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => publishedArticles(ARTICLES).map((a) => ({ locale, slug: a.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticle(slug);
  if (!article || article.status !== 'published') return {};
  const title = resolveLocalized(article.title, locale).value;
  const description = resolveLocalized(article.description, locale).value;
  return pageMetadata({
    locale,
    path: articleHref(slug),
    title,
    description,
    ownLocales: ownLocalesOf(article, routing.locales),
    openGraph: {
      type: 'article',
      publishedTime: article.publishedAt,
      ...(article.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      ...(article.image ? { images: [{ url: article.image.url }] } : {}),
    },
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = getArticle(slug);
  if (!article) notFound();
  // A withdrawn article has no text to serve: send the reader to its topic (307), outside any try/catch.
  if (article.status === 'withdrawn') redirect({ href: journalHref({ tags: [article.topicTag] }), locale });
  return <ArticleView article={article} locale={locale} />;
}
