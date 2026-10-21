'use client';

import { useTranslations } from 'next-intl';
import Chip from '@/components/ui/Chip';
import type { OrderFilter } from '@/lib/types';

const FILTERS: { id: OrderFilter; key: string }[] = [
  { id: 'all', key: 'all' },
  { id: 'in-progress', key: 'inProgress' },
  { id: 'ready', key: 'ready' },
  { id: 'completed', key: 'completed' },
];

/** Filter chips (`aria-pressed`). The Ready chip is hidden where there is no collection (Canada). */
export default function OrderFilters({
  value,
  onChange,
  collection,
}: {
  value: OrderFilter;
  onChange: (filter: OrderFilter) => void;
  collection: boolean;
}) {
  const t = useTranslations('account.orders');
  return (
    <div role="group" aria-label={t('filterLabel')} className="mb-5 flex flex-wrap gap-2">
      {FILTERS.filter((f) => collection || f.id !== 'ready').map((f) => (
        <Chip key={f.id} active={value === f.id} onClick={() => onChange(f.id)}>
          {t(`filter.${f.key}`)}
        </Chip>
      ))}
    </div>
  );
}
