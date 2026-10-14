/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useLowStock } from '@/hooks/dashboard';
import { getLocalizedString } from '@/lib/utils';
import { statusOf, WidgetCard } from './WidgetCard';

export function LowStockByBranch() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const stock = useLowStock();
  const branches = stock.data ?? [];
  // "All branches are stocked" when no branch has a low part (also when the store has no branches).
  const nothingLow = branches.every((b) => b.parts.length === 0);
  return (
    <WidgetCard testId="widget-stock" title={t('stock.title')} status={statusOf(stock)} errorTitle={t('stock.errorTitle')} errorMessage={t('stock.errorMessage')} onRetry={stock.retry}>
      {nothingLow ? (
        <p data-testid="stock-empty" className="text-body-2 font-medium text-text-subdued">{t('stock.empty')}</p>
      ) : (
        <div className="flex flex-col gap-400">
          {branches.map((b) => (
            <div key={b.branch.key}>
              <h3 className="text-caption-1 font-semibold text-text-subdued">{getLocalizedString(b.branch.name, locale)}</h3>
              {b.parts.length === 0 ? (
                <p className="text-caption-1 font-medium text-text-subdued">{t('stock.noneInBranch')}</p>
              ) : (
                <ul>
                  {b.parts.map((p) => (
                    <li key={p.sku} className="flex items-baseline justify-between gap-300 py-100">
                      <span className="min-w-0 truncate text-body-2 font-medium text-text">{getLocalizedString(p.name, locale)}</span>
                      <span className={`flex-none rounded-100 px-200 text-caption-1 font-semibold text-text ${p.available === 0 ? 'bg-bg-critical-subdued' : 'bg-bg-warning-subdued'}`}>{t('stock.available', { count: p.available })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
