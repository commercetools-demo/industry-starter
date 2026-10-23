'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export interface SortOption { value: string; label: string; href: string }

/** Native select; choosing an option navigates to its URL (a history entry, page reset). Hrefs come from the server. */
export default function SortSelect({ value, options }: { value: string; options: SortOption[] }) {
  const t = useTranslations('plp.sort');
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <span className="max-mobile:sr-only">{t('label')}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) router.push(next.href);
        }}
        className="rounded-pill border border-line-2 bg-surface py-2 pl-4 pr-8 text-[13px] font-medium text-ink focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
