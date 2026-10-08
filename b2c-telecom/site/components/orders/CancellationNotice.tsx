import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/account/format';
import type { Locale, Order } from '@/lib/types';

/** Shown on a cancelled order: when, why (and the buyer's note), and that nothing more will be charged. */
export function CancellationNotice({ order }: { order: Order }): ReactElement | null {
  const t = useTranslations('orders');
  const locale = useLocale() as Locale;
  if (order.orderState !== 'Cancelled') return null;
  const record = order.cancellation;
  return (
    <section role="status" aria-label={t('cancelled.title', { date: record ? formatDate(record.cancelledAt, locale) : '' })} className="flex flex-col gap-2 rounded-xl border border-danger bg-pink-50 p-7" data-print="hide">
      <p className="m-0 font-display text-lg font-semibold text-danger">{record ? t('cancelled.title', { date: formatDate(record.cancelledAt, locale) }) : t('cancelled.titleNoDate')}</p>
      {record ? <p className="m-0 text-md">{t('cancelled.reason', { reason: t(`cancel.reason.${record.reason}`) })}</p> : null}
      {record?.note ? <p className="m-0 text-md">&ldquo;{record.note}&rdquo;</p> : null}
      <p className="m-0 text-md">{t('cancelled.noCharges')}</p>
    </section>
  );
}
