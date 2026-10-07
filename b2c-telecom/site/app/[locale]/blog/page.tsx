import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BlogCard } from '@/components/content/BlogCard';
import { BlogFilters } from '@/components/content/BlogFilters';
import { PAGE_COLUMN, PAGE_FRAME, PAGE_TITLE } from '@/components/content/prose';
import { listArticles, parseTagFilter } from '@/lib/content/blog';
import { absoluteUrl } from '@/lib/content/metadata';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string | string[] }>;
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'content.blog' });
  // ?tag= variants canonicalise to the plain listing.
  return { title: t('title'), description: t('description'), alternates: { canonical: absoluteUrl(locale, '/blog') } };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const tags = parseTagFilter((await searchParams).tag);
  const { articles, allTags } = listArticles(locale, { tags });
  const t = await getTranslations({ locale, namespace: 'content.blog' });

  return (
    <div className={PAGE_FRAME}>
      <div className={PAGE_COLUMN}>
        <h1 className={`m-0 ${PAGE_TITLE}`}>{t('title')}</h1>
        <p className="mt-4 mb-0 font-body text-lg text-text-muted">{t('description')}</p>
        <div className="mt-7">
          <BlogFilters allTags={allTags} applied={tags} />
        </div>
        {articles.length === 0 ? (
          <p role="status" className="mt-7 font-body text-md text-text">
            {t('noMatch')}
          </p>
        ) : (
          <ul className="m-0 mt-7 flex list-none flex-col gap-5 p-0">
            {articles.map((article) => (
              <li key={article.slug}>
                <BlogCard article={article} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
