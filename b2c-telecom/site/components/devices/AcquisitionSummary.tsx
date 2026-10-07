import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyExact } from '@/lib/format';
import type { AcquisitionQuote, Locale } from '@/lib/types';
import { EndOfTermNotice } from './EndOfTermNotice';

type AcquisitionSummaryProps = {
  quote: AcquisitionQuote;
  /** The dates are computed from today (the card, not an order): say so. */
  estimate?: boolean;
};

/** What is due today, what follows each month, the total and the end-of-term obligation of one mode and term. */
export function AcquisitionSummary({ quote, estimate = true }: AcquisitionSummaryProps): ReactElement {
  const t = useTranslations('devices');
  const locale = useLocale() as Locale;
  return (
    <div aria-live="polite" className="flex flex-col gap-3 rounded-xl bg-brand-100 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-semibold">{t('summary.dueToday')}</span>
        <span className="font-display text-2xl font-bold">{formatMoneyExact(quote.dueNow, locale)}</span>
      </div>
      {quote.recurring ? <p className="m-0 text-md">{t('summary.then', { price: formatMoneyExact(quote.recurring.amount, locale), count: quote.recurring.remaining })}</p> : null}
      <p className="m-0 text-md font-semibold">{t('summary.total', { price: formatMoneyExact(quote.totalPayable, locale) })}</p>
      <EndOfTermNotice endOfTerm={quote.endOfTerm} endDate={quote.endDate} estimate={estimate} />
    </div>
  );
}
