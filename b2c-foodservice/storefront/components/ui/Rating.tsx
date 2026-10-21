'use client';

import { useLocale, useTranslations } from 'next-intl';
import Icon from './Icon';

export interface RatingProps {
  /** Average rating from the product's reviewRatingStatistics. */
  value: number;
  count?: number;
  small?: boolean;
}

export default function Rating({ value, count, small = false }: RatingProps) {
  const t = useTranslations('ui.rating');
  const locale = useLocale();
  if (!(value > 0)) return null;
  const shown = (Math.round(value * 10) / 10).toFixed(1);
  const label = count === undefined ? undefined : t('label', { value: shown, count });
  return (
    <div
      className="flex items-center gap-[5px] text-[12.5px] text-ink-2"
      {...(label ? { role: 'img', 'aria-label': label } : {})}
    >
      <Icon name="star" size={small ? 12 : 14} fill="currentColor" className="text-ink" />
      <span aria-hidden={label ? true : undefined} className="font-semibold">
        {shown}
      </span>
      {count !== undefined ? (
        <span aria-hidden="true" className="text-ink-3">
          ({new Intl.NumberFormat(locale).format(count)})
        </span>
      ) : null}
    </div>
  );
}
