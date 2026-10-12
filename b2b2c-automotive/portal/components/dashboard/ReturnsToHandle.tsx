'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useReturnsToHandle } from '@/hooks/dashboard';
import { Link } from '@/i18n/routing';
import { getLocalizedString } from '@/lib/utils';
import { statusOf, WidgetCard } from './WidgetCard';

export function ReturnsToHandle() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const returns = useReturnsToHandle();
  const rows = returns.data ?? [];
  return (
    <WidgetCard
      testId="widget-returns"
      title={t('returns.title')}
      status={statusOf(returns)}
      errorTitle={t('returns.errorTitle')}
      errorMessage={t('returns.errorMessage')}
      onRetry={returns.retry}
      action={
        <Link href="/returns" className="text-button-2 font-bold text-text-active hover:underline">
          {t('headsUp.review')}
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p data-testid="returns-empty" className="text-body-2 font-medium text-text-subdued">{t('returns.empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-300 border-t border-border-subdued py-200 first:border-t-0 first:pt-0">
              <div className="min-w-0">
                <p className="text-body-2 font-semibold text-text">{r.returnNumber}</p>
                <p className="text-caption-1 font-medium text-text-subdued">
                  {t('returns.order', { order: r.orderNumber })}
                  {r.customer ? ` · ${r.customer}` : ''}
                </p>
                {r.items.map((i, n) => (
                  <p key={n} className="truncate text-caption-1 font-medium text-text">{t('returns.item', { quantity: i.quantity, name: getLocalizedString(i.name, locale) })}</p>
                ))}
              </div>
              <span className="inline-flex h-600 flex-none items-center rounded-100 bg-bg-warning-subdued px-200 text-caption-1 font-semibold text-text">{t(`returns.status.${r.status}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
