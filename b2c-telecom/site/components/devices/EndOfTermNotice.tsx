import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDeviceDate } from '@/lib/devices/format';
import type { EndOfTerm, Locale } from '@/lib/types';

type EndOfTermNoticeProps = {
  endOfTerm: EndOfTerm;
  /** ISO date: the final payment (installments) or the return-by date (lease). */
  endDate?: string | undefined;
  /** True while the date is computed from today (before the order): the notice says so. */
  estimate?: boolean;
  className?: string;
};

/** What happens at the end of the term, with the date it falls due: owned from day one, owned after the final payment, or returned. */
export function EndOfTermNotice({ endOfTerm, endDate, estimate = false, className }: EndOfTermNoticeProps): ReactElement {
  const t = useTranslations('devices');
  const locale = useLocale() as Locale;
  const date = endDate ? formatDeviceDate(endDate, locale) : '';
  const text = endOfTerm === 'owned' ? t('endOfTerm.owned') : endOfTerm === 'return' ? t('endOfTerm.return', { date }) : t('endOfTerm.ownedAfterFinalPayment', { date });
  return (
    <p className={className ?? 'm-0 text-sm text-text-muted'}>
      {text}
      {estimate && endDate ? ` ${t('estimate')}` : ''}
    </p>
  );
}
