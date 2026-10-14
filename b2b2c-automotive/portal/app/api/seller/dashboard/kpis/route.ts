// GET /api/seller/dashboard/kpis: Open returns, Active subscriptions, Unanswered reviews (S-05). Each value is null when only
// its own source failed. Open orders comes with the recent-orders endpoint (shared key).
import { dashboardRoute } from '@/lib/ct/seller/dashboard/route-helper';
import type { DashboardKpis } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const value = (r: PromiseSettledResult<number>): number | null => (r.status === 'fulfilled' ? r.value : null);

export const GET = dashboardRoute<DashboardKpis>({
  widget: 'kpis',
  empty: { openReturns: 0, activeSubscriptions: 0, unansweredReviews: 0 },
  read: async (storeKey, ports) => {
    const [returns, subscriptions, reviews] = await Promise.allSettled([ports.openReturns(storeKey), ports.activeSubscriptions(storeKey), ports.unansweredReviews(storeKey)]);
    return { openReturns: value(returns), activeSubscriptions: value(subscriptions), unansweredReviews: value(reviews) };
  },
});
