// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { getHeadsUp } from './heads-up';
import { countOpenOrders, listRecentOrders } from './orders';
import type { DashboardPorts } from './ports';
import { countOpenReturns, listReturnsToHandle } from './returns';
import { countUnansweredReviews } from './reviews';
import { lowStockByBranch } from './stock';
import { getStoreHeader } from './store-header';
import { loadStorePerformance } from './store-performance';
import { countActiveSubscriptions, listRenewals } from './subscriptions';

export const liveDashboardPorts: DashboardPorts = {
  openOrders: countOpenOrders,
  recentOrders: (storeKey) => listRecentOrders(storeKey),
  openReturns: countOpenReturns,
  returnsToHandle: (storeKey) => listReturnsToHandle(storeKey),
  activeSubscriptions: countActiveSubscriptions,
  renewals: (storeKey) => listRenewals(storeKey),
  unansweredReviews: countUnansweredReviews,
  lowStock: lowStockByBranch,
  headsUp: (storeKey) => getHeadsUp(storeKey),
  storePerformance: (storeKey) => loadStorePerformance(storeKey),
  storeHeader: getStoreHeader,
};
