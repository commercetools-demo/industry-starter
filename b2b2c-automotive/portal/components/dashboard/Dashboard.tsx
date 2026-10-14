/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useDashboardKpis, useRecentOrders } from '@/hooks/dashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { HeadsUpBanner } from './HeadsUpBanner';
import { KpiCard, type KpiState } from './KpiCard';
import { LowStockByBranch } from './LowStockByBranch';
import { RecentOrders } from './RecentOrders';
import { ReturnsToHandle } from './ReturnsToHandle';
import { StorePerformance } from './StorePerformance';
import { SubscriptionsRenewing } from './SubscriptionsRenewing';

// Tokens only: 200 px is space-3200 + space-1600 + space-200, 320 px is space-6400 + space-1600.
const KPI_GRID = 'repeat(auto-fit, minmax(calc(var(--space-3200) + var(--space-1600) + var(--space-200)), 1fr))';
const PAIR_GRID = 'repeat(auto-fit, minmax(calc(var(--space-6400) + var(--space-1600)), 1fr))';

const stateOf = (loading: boolean, value: number | null | undefined, failed: boolean): KpiState => (failed ? 'unavailable' : loading || value === undefined ? 'loading' : value === null ? 'unavailable' : 'ok');

/**
 * The dashboard body: every widget has its own hook (own endpoint, own SWR key, own states), so one failing source shows its
 * error in its own card and nothing else changes. The Open orders KPI shares the orders key (one request, one Retry).
 * `performanceEnabled` is the server switch PORTAL_STORE_PERFORMANCE; the role check decides the rest.
 */
export function Dashboard({ performanceEnabled = true }: { performanceEnabled?: boolean }) {
  const t = useTranslations('dashboard');
  const { can } = usePermissions();
  const orders = useRecentOrders();
  const kpis = useDashboardKpis();
  const showStore = performanceEnabled && can('store.view-performance');
  const kpi = kpis.data;
  return (
    <div data-testid="dashboard-body" className="flex w-full flex-col gap-400">
      <HeadsUpBanner />
      <div className="grid gap-400" style={{ gridTemplateColumns: KPI_GRID }}>
        <KpiCard id="open-orders" label={t('kpi.openOrders.label')} note={t('kpi.openOrders.note')} value={orders.data?.openCount ?? null} state={stateOf(orders.isLoading, orders.data?.openCount, Boolean(orders.error))} />
        <KpiCard id="open-returns" label={t('kpi.openReturns.label')} note={t('kpi.openReturns.note')} value={kpi?.openReturns ?? null} state={stateOf(kpis.isLoading, kpi?.openReturns, Boolean(kpis.error))} />
        <KpiCard id="active-subscriptions" label={t('kpi.activeSubscriptions.label')} note={t('kpi.activeSubscriptions.note')} value={kpi?.activeSubscriptions ?? null} state={stateOf(kpis.isLoading, kpi?.activeSubscriptions, Boolean(kpis.error))} />
        <KpiCard id="unanswered-reviews" label={t('kpi.unansweredReviews.label')} note={t('kpi.unansweredReviews.note')} value={kpi?.unansweredReviews ?? null} state={stateOf(kpis.isLoading, kpi?.unansweredReviews, Boolean(kpis.error))} />
      </div>
      <div className="grid gap-400" style={{ gridTemplateColumns: PAIR_GRID }}>
        <RecentOrders />
        <ReturnsToHandle />
      </div>
      <div className="grid gap-400" style={{ gridTemplateColumns: PAIR_GRID }}>
        <LowStockByBranch />
        <SubscriptionsRenewing />
      </div>
      {showStore ? (
        <section aria-labelledby="dashboard-your-store" className="flex flex-col gap-400">
          <h2 id="dashboard-your-store" className="text-title-1 font-semibold text-text">{t('store.group')}</h2>
          <StorePerformance />
        </section>
      ) : null}
    </div>
  );
}
