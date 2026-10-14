/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRenewals } from '@/hooks/dashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { Link } from '@/i18n/routing';
import { getLocalizedString } from '@/lib/utils';
import { statusOf, WidgetCard } from './WidgetCard';

export function SubscriptionsRenewing() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const renewals = useRenewals();
  const { can } = usePermissions();
  const rows = renewals.data ?? [];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
  return (
    <WidgetCard
      testId="widget-renewals"
      title={t('renewals.title')}
      status={statusOf(renewals)}
      errorTitle={t('renewals.errorTitle')}
      errorMessage={t('renewals.errorMessage')}
      onRetry={renewals.retry}
      action={
        can('subscriptions.view') ? (
          <Link href="/subscriptions" className="inline-flex min-h-600 items-center text-button-2 font-bold text-text-active hover:underline">
            {t('headsUp.review')}
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p data-testid="renewals-empty" className="text-body-2 font-medium text-text-subdued">{t('renewals.empty')}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-300 border-t border-border-subdued py-200 first:border-t-0 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-body-2 font-semibold text-text">{getLocalizedString(r.name, locale)}</p>
                {r.itemCount > 1 ? <p className="text-caption-1 font-medium text-text-subdued">{t('renewals.more', { count: r.itemCount - 1 })}</p> : null}
              </div>
              <time dateTime={r.nextOrderAt} className="flex-none text-body-2 font-medium text-text-subdued">{date.format(new Date(r.nextOrderAt))}</time>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
