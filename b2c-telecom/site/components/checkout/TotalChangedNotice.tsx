'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, Money } from '@/lib/types';

type Props = { oldTotal: Money; newTotal: Money; onReview: () => void };

/** The total moved after the buyer saw it (D-042): say from what to what, and offer one way on: review again, then pay again. */
export function TotalChangedNotice({ oldTotal, newTotal, onReview }: Props): ReactElement {
  const t = useTranslations('checkout');
  const locale = useLocale() as Locale;
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-xl border-2 border-danger bg-surface p-5">
      <p className="m-0 text-md font-semibold">{t('totalChanged', { old: formatMoneyExact(oldTotal, locale), new: formatMoneyExact(newTotal, locale) })}</p>
      <div>
        <Button onClick={onReview}>{t('reviewAgain')}</Button>
      </div>
    </div>
  );
}
