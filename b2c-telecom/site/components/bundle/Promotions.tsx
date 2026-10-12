'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyExact } from '@/lib/format';
import type { AppliedPromotion, Locale } from '@/lib/types';

/**
 * The promotions the engine applied, with the amount each took off (the engine's own discounted amounts). A promotion that reduced one
 * line is shown under that line (`LinePromotions`); the others are listed after the lines (`Promotions`). Nothing applied renders nothing.
 * No validity columns: no promotion has a duration, every one applies to the first order only.
 */
export function Promotions({ promotions }: { promotions: AppliedPromotion[] }): ReactElement | null {
  const t = useTranslations('bundle.promotions');
  const locale = useLocale() as Locale;
  if (promotions.length === 0) return null;
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2">
      <h2 className="m-0 mt-2 font-display text-3xl font-bold tracking-ui">{t('title')}</h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md">
        {promotions.map((promotion) => (
          <li key={promotion.key}>{t('off', { name: promotion.name, amount: formatMoneyExact(promotion.amount, locale) })}</li>
        ))}
      </ul>
    </section>
  );
}

/** Promotions that reduced only this line, under its price. */
export function LinePromotions({ promotions }: { promotions?: AppliedPromotion[] | undefined }): ReactElement | null {
  const t = useTranslations('bundle.promotions');
  const locale = useLocale() as Locale;
  if (!promotions || promotions.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm font-semibold">
      {promotions.map((promotion) => (
        <li key={promotion.key}>{t('off', { name: promotion.name, amount: formatMoneyExact(promotion.amount, locale) })}</li>
      ))}
    </ul>
  );
}
