// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/Select';
import { usePathname, useRouter } from '@/i18n/routing';
import { SORT_KEYS, type SortKey } from '@/lib/search/params';

const LABEL: Record<SortKey, 'sortPopular' | 'sortPriceAsc' | 'sortPriceDesc' | 'sortRated'> = {
  popular: 'sortPopular',
  'price-asc': 'sortPriceAsc',
  'price-desc': 'sortPriceDesc',
  rated: 'sortRated',
};

/**
 * Sort control: Most popular, Price low to high, Price high to low, Top rated (a search also offers "Best match", its default).
 * The choice goes to the address (`sort`), the page goes back to 1, every other parameter stays.
 */
export function SortSelect({ value, hasQuery }: { value: SortKey | 'relevance'; hasQuery: boolean }) {
  const t = useTranslations('listing');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const query = new URLSearchParams(params.toString());
    // The default order of the surface needs no parameter: popular on a listing, relevance on a search.
    if ((next === 'popular' && !hasQuery) || next === 'relevance') query.delete('sort');
    else query.set('sort', next);
    query.delete('page');
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Select label={t('sortLabel')} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-[12rem]">
      {hasQuery ? <option value="relevance">{t('sortRelevance')}</option> : null}
      {SORT_KEYS.map((key) => (
        <option key={key} value={key}>
          {t(LABEL[key])}
        </option>
      ))}
    </Select>
  );
}
