'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Select } from '@/components/ui/Field';
import type { ReviewSort } from '@/lib/types';

const SORTS: readonly ReviewSort[] = ['newest', 'highest', 'lowest'];

export default function SortSelect({ value, onChange }: { value: ReviewSort; onChange: (sort: ReviewSort) => void }) {
  const t = useTranslations('reviews');
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-ink-2">
        {t('sortBy')}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as ReviewSort)} className="!w-auto min-h-11 !py-2.5">
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
