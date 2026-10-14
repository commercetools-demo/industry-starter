/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { BranchStock, DashboardKpis, HeadsUp, RecentOrdersResponse, RenewalRow, ReturnRow, StorePerformance } from '@/lib/dashboard/types';
import { useDashboardWidget } from './useDashboardWidget';

const BASE = '/api/seller/dashboard';

export const useRecentOrders = () => useDashboardWidget<RecentOrdersResponse>('dashboard-orders', `${BASE}/recent-orders`);
export const useDashboardKpis = () => useDashboardWidget<DashboardKpis>('dashboard-kpis', `${BASE}/kpis`);
export const useReturnsToHandle = () => useDashboardWidget<ReturnRow[]>('dashboard-returns', `${BASE}/returns`);
export const useLowStock = () => useDashboardWidget<BranchStock[]>('dashboard-stock', `${BASE}/stock`);
export const useRenewals = () => useDashboardWidget<RenewalRow[]>('dashboard-renewals', `${BASE}/renewals`);
export const useHeadsUp = () => useDashboardWidget<HeadsUp | null>('dashboard-heads-up', `${BASE}/heads-up`);
/** Admin only: pass `enabled = false` for a Buyer so no request is made. */
export const useStorePerformance = (enabled: boolean) => useDashboardWidget<StorePerformance>('dashboard-store-performance', `${BASE}/store-performance`, enabled);
