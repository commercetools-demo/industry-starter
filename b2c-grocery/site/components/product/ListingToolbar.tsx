'use client';

import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { SORT_KEYS, type ListingParams } from '@/lib/listing-params';
import type { SortKey } from '@/lib/types';
import { useListingNavigation } from './filter-data';

const SORT_LABEL: Record<SortKey, 'relevance' | 'newest' | 'priceAsc' | 'priceDesc'> = {
  relevance: 'relevance',
  newest: 'newest',
  'price-asc': 'priceAsc',
  'price-desc': 'priceDesc',
};

/** "N products" on the left, the sort on the right (segmented from tablet up, a select on mobile). */
export function ListingToolbar({ total, params }: { total: number; params: ListingParams }) {
  const t = useTranslations('plp');
  const { apply } = useListingNavigation(params);
  const options = SORT_KEYS.map((key) => ({ value: key, label: t(`sort.${SORT_LABEL[key]}`) }));
  const onSort = (value: string) => apply({ sort: value as SortKey });
  return (
    <div className="mb-(--space-4) flex flex-wrap items-center justify-between gap-(--space-3) border-b border-divider pb-(--space-4)">
      <p role="status" className="m-0 text-[14px] text-muted">
        {t('count', { count: total })}
      </p>
      <Segmented className="hidden tablet:inline-flex" label={t('sort.label')} options={options} value={params.sort} onChange={onSort} />
      <Select fieldClassName="tablet:hidden" label={t('sort.label')} value={params.sort} onChange={(event) => onSort(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
