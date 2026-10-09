import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Article } from '@/lib/content';
import { HomeImage } from './HomeImage';

/**
 * Three journal cards (180 px banner area, "Category · N min read", linked title). Omitted while there are no
 * articles to show: the page passes an empty list unless the journal row exists (lib/routes `showJournal`).
 */
export function JournalRow({ articles }: { articles: readonly Article[] }) {
  const t = useTranslations('home.journal');
  if (articles.length === 0) return null;
  return (
    <section id="journal" aria-labelledby="home-journal-title" className="py-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <h2 id="home-journal-title" className="font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-text-heading">
            {t('title')}
          </h2>
          <Link href="/journal" className="font-display text-sm font-medium">
            {t('all')} →
          </Link>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,18.75rem),1fr))] gap-6 p-0">
          {articles.map((article) => (
            <li key={article.slug} className="overflow-hidden rounded-lg bg-surface shadow-sm">
              <HomeImage className="h-45" />
              <div className="grid gap-2 p-5">
                <small className="font-meta text-xs text-neutral-600">{t('meta', { category: article.category, minutes: article.minutes })}</small>
                <h3 className="font-display text-lg font-semibold text-text-heading">
                  <Link href={`/journal/${article.slug}`} className="text-text-heading hover:text-brand-800">
                    {article.title}
                  </Link>
                </h3>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
