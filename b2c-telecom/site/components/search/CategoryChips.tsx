import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { CHIP_CLASSES } from '@/components/offers/FilterChips';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { toSearchQueryString, withSearchChange, type SearchParams } from '@/lib/search/params';
import type { SearchCategoryCount } from '@/lib/types';

type CategoryChipsProps = {
  categories: SearchCategoryCount[];
  /** Number of results over all categories (the "All" chip). */
  total: number;
  params: SearchParams;
};

/**
 * Category chips of the results (real links, so the state is the URL): "All (n)" and one chip per category with matches. Clicking the
 * active chip or All removes the filter. Hidden while fewer than two categories match.
 */
export function CategoryChips({ categories, total, params }: CategoryChipsProps): ReactElement | null {
  const t = useTranslations('search');
  if (categories.length < 2) return null;
  const href = (category: string | null): string => `/search${toSearchQueryString(withSearchChange(params, { category }))}`;
  return (
    <nav aria-label={t('categoriesLabel')}>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        <li>
          <Link
            href={href(null)}
            aria-current={params.category === null ? 'true' : undefined}
            className={cx(CHIP_CLASSES, params.category === null ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}
          >
            {t('all', { count: total })}
          </Link>
        </li>
        {categories.map((category) => {
          const active = params.category === category.key;
          return (
            <li key={category.key}>
              <Link
                href={href(active ? null : category.key)}
                aria-current={active ? 'true' : undefined}
                className={cx(CHIP_CLASSES, active ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}
              >
                {category.name} ({category.count})
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
