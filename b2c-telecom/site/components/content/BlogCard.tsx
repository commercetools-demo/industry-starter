import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import type { ArticleSummary } from '@/lib/content/blog';
import { formatDate } from '@/lib/content/format';
import { isContentLocale } from '@/lib/content/types';
import { TagLinks } from './TagLinks';

/** One article in the listing: date, title, description and topic chips. */
export function BlogCard({ article }: { article: ArticleSummary }): ReactElement {
  const t = useTranslations('content.blog');
  const locale = useLocale();
  const shown = isContentLocale(locale) ? locale : 'en-US';
  return (
    <Card as="article" className="p-7">
      <div lang={article.fallback && shown !== 'en-US' ? 'en' : undefined}>
        <p className="m-0 font-body text-sm text-text-muted">{t('publishedOn', { date: formatDate(article.date, shown) })}</p>
        <h2 className="m-0 mt-2 font-display text-2xl font-bold leading-tight text-brand-950">
          <Link href={`/blog/${article.slug}`} className="text-brand-950 no-underline hover:underline">
            {article.title}
          </Link>
        </h2>
        <p className="m-0 mt-3 font-body text-md text-text">{article.description}</p>
      </div>
      <div className="mt-5">
        <TagLinks tags={article.tags} />
      </div>
    </Card>
  );
}
