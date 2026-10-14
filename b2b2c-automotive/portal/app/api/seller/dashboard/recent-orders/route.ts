/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/dashboard/recent-orders: newest storefront orders of the session store plus the Open orders count (S-05).
// The widget and the Open orders KPI share this one endpoint, so one failure and one Retry cover both.
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { RecentOrdersResponse } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export const GET = dashboardRoute<RecentOrdersResponse>({
  widget: 'orders',
  empty: { orders: [], openCount: 0 },
  read: async (storeKey, ports) => {
    const [orders, openCount] = await Promise.all([ports.recentOrders(storeKey), ports.openOrders(storeKey)]);
    return { orders, openCount };
  },
});
