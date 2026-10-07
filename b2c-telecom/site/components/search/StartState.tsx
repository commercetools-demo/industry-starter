import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { CHIP_CLASSES } from '@/components/offers/FilterChips';
import { Link } from '@/i18n/routing';
import { POPULAR_SEARCHES } from '@/lib/config/search';
import { cx } from '@/lib/cx';
import type { CategoryTile } from '@/lib/search/tiles';
import type { Locale } from '@/lib/types';
import { CategoryTiles } from './CategoryTiles';

/**
 * No query yet (or one character): popular searches (curated, there is no type-ahead, D-056) and the category tiles.
 * `hint` is shown for a one-character query.
 */
export function StartState({ hint, tiles }: { hint: boolean; tiles: CategoryTile[] }): ReactElement {
  const t = useTranslations('search');
  const locale = useLocale() as Locale;
  return (
    <section aria-label={t('popular')} className="flex flex-col items-start gap-5">
      {hint ? (
        <p role="status" className="m-0 text-md text-text-muted">
          {t('start.hint')}
        </p>
      ) : null}
      <h2 className="m-0 font-display text-xl font-bold">{t('popular')}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {POPULAR_SEARCHES[locale].map((term) => (
          <li key={term}>
            <Link href={`/search?q=${encodeURIComponent(term)}`} className={cx(CHIP_CLASSES, 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}>
              {term}
            </Link>
          </li>
        ))}
      </ul>
      <CategoryTiles tiles={tiles} label={t('browse')} />
    </section>
  );
}
