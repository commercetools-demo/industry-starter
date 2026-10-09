import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import type { Article } from '@/lib/content';
import { ArticleCover } from './ArticleCover';

/** Listing and related-content card: cover, category, linked title, description, reading time. */
export function ArticleCard({ article }: { article: Article }) {
  const t = useTranslations('static.journal');
  return (
    <Card as="article" className="grid content-start gap-3 p-4">
      <ArticleCover />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{article.category}</Badge>
        <span className="font-meta text-xs text-neutral-600">{t('minutes', { count: article.minutes })}</span>
      </div>
      <h2 className="m-0 font-display text-lg font-medium text-navy-900">
        <Link href={`/journal/${article.slug}`} className="text-navy-900 hover:text-brand-800">
          {article.title}
        </Link>
      </h2>
      <p className="m-0 text-neutral-600">{article.description}</p>
    </Card>
  );
}
