/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useStorePerformance } from '@/hooks/dashboard';
import type { StorePerformance as Performance } from '@/lib/dashboard/types';
import { formatMoney, getLocalizedString } from '@/lib/utils';
import { SalesBars } from './SalesBars';
import { statusOf, WidgetCard } from './WidgetCard';

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div data-testid={`perf-${id}`} className="flex flex-col gap-050">
      <dt className="text-caption-1 font-semibold text-text-subdued">{label}</dt>
      <dd className="text-title-1 font-bold text-text">{value}</dd>
    </div>
  );
}

function Body({ data }: { data: Performance }) {
  const t = useTranslations('dashboard.store');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string; fractionDigits: number }) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);
  if (data.orders === 0) return <p data-testid="perf-empty" className="text-body-2 font-medium text-text-subdued">{t('empty')}</p>;
  const top = Math.max(1, ...data.topProducts.map((p) => p.revenue.centAmount));
  return (
    <div className="flex flex-col gap-600">
      <dl className="grid grid-cols-3 gap-400 narrow:grid-cols-1">
        <Stat id="sales" label={t('sales')} value={money(data.sales)} />
        <Stat id="orders" label={t('orders')} value={new Intl.NumberFormat(locale).format(data.orders)} />
        <Stat id="average" label={t('average')} value={data.averageOrder ? money(data.averageOrder) : '–'} />
      </dl>
      {data.daily.length > 0 ? <SalesBars daily={data.daily} currency={data.currency} fractionDigits={data.sales.fractionDigits} /> : null}
      <div>
        <h3 className="mb-200 text-caption-1 font-semibold text-text-subdued">{t('topProducts')}</h3>
        <ol data-testid="top-products" className="flex flex-col gap-300">
          {data.topProducts.map((p) => (
            <li key={p.sku} className="flex flex-col gap-100">
              <div className="flex items-baseline justify-between gap-300">
                <span className="min-w-0 truncate text-body-2 font-semibold text-text">{getLocalizedString(p.name, locale)}</span>
                <span className="flex-none text-caption-1 font-medium text-text-subdued">
                  {t('units', { count: p.units })} · {money(p.revenue)}
                </span>
              </div>
              <div aria-hidden="true" className="h-100 rounded-100 bg-bg-surface-subdued">
                <div className="h-full rounded-100 bg-chart-1" style={{ width: `${(p.revenue.centAmount / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
      {data.truncated ? <p className="text-caption-1 font-medium text-text-subdued">{t('truncated')}</p> : null}
    </div>
  );
}

/** Admin only (the Dashboard does not render it for a Buyer, and the endpoint answers 403 anyway). */
export function StorePerformance() {
  const t = useTranslations('dashboard.store');
  const perf = useStorePerformance(true);
  return (
    <WidgetCard
      testId="widget-store-performance"
      title={t('title')}
      action={<span className="text-caption-1 font-medium text-text-subdued">{t('period')}</span>}
      status={statusOf(perf)}
      errorTitle={t('errorTitle')}
      errorMessage={t('errorMessage')}
      onRetry={perf.retry}
    >
      {perf.data ? <Body data={perf.data} /> : null}
    </WidgetCard>
  );
}
