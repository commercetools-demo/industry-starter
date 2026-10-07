'use client';

import type { ChangeEvent, ReactElement } from 'react';
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { usePathname, useRouter } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { toSearchQueryString, withSearchChange, type SearchParams } from '@/lib/search/params';
import type { SearchSort } from '@/lib/types';

const OPTIONS: { id: SearchSort; key: 'relevance' | 'priceAsc' | 'priceDesc' }[] = [
  { id: 'relevance', key: 'relevance' },
  { id: 'price-asc', key: 'priceAsc' },
  { id: 'price-desc', key: 'priceDesc' },
];

/**
 * Sort control of the search page (N's `SortSelect` only knows the listing's two orders, so search has its own with "Best match").
 * It only changes the URL; sorting happens on the server and a sort change goes back to page 1.
 */
export function SearchSortSelect({ params }: { params: SearchParams }): ReactElement {
  const t = useTranslations('search.sort');
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const sort = OPTIONS.find((option) => option.id === event.target.value)?.id;
    if (sort) router.replace(`${pathname}${toSearchQueryString(withSearchChange(params, { sort }))}`);
  };
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="font-display text-sm font-semibold">
        {t('label')}
      </label>
      <select
        id={id}
        value={params.sort}
        onChange={onChange}
        className={cx('min-h-11 rounded-pill border-2 border-border bg-surface px-5 font-display text-sm font-semibold text-text', FOCUS_RING)}
      >
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {t(option.key)}
          </option>
        ))}
      </select>
    </div>
  );
}
