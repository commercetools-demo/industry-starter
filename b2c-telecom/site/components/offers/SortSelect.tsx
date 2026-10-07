'use client';

import type { ChangeEvent, ReactElement } from 'react';
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { usePathname, useRouter } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { toQueryString, withListingChange } from '@/lib/listing/params';
import type { ListingParams, ListingSort } from '@/lib/types';

const OPTIONS: { id: ListingSort; key: 'priceAsc' | 'priceDesc' }[] = [
  { id: 'price-asc', key: 'priceAsc' },
  { id: 'price-desc', key: 'priceDesc' },
];

/**
 * Sort control (undrawn: Junior design choice, D-068 and D-064): a pill-shaped native select. It only changes the URL; the list is
 * sorted on the server from the `sort` parameter, so there is no sort state in the browser.
 */
export function SortSelect({ params }: { params: ListingParams }): ReactElement {
  const t = useTranslations('plp.sort');
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const sort = OPTIONS.find((option) => option.id === event.target.value)?.id;
    if (sort) router.replace(`${pathname}${toQueryString(withListingChange(params, { sort }))}`);
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
