// GET /api/seller/dashboard/store-performance: sales, orders, average order, top products and the daily series of the last 30
// days (S-04). Admin only: the role check (`store.view-performance`) runs before any commercetools call. `PORTAL_STORE_PERFORMANCE=off`
// switches the block off (404), decision 7.
import { ApiError } from '@/lib/api';
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { StorePerformance } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const EMPTY: StorePerformance = {
  currency: 'EUR',
  periodDays: 30,
  sales: { centAmount: 0, currencyCode: 'EUR', fractionDigits: 2 },
  orders: 0,
  averageOrder: null,
  topProducts: [],
  daily: [],
  truncated: false,
};

export const GET = dashboardRoute<StorePerformance>({
  widget: 'store-performance',
  action: 'store.view-performance',
  empty: EMPTY,
  read: (storeKey, ports) => {
    if (process.env.PORTAL_STORE_PERFORMANCE === 'off') throw new ApiError(404, 'Not found');
    return ports.storePerformance(storeKey);
  },
});
