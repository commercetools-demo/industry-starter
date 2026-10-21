import { handle, requireCustomer } from '@/lib/api';
import { withBudget } from '@/lib/account/budget';
import { countOrders } from '@/lib/ct/account-orders';
import { findList } from '@/lib/ct/shopping-lists';
import type { AccountSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/summary -> 200 { openOrders, readyForCollection, savedItems }. Three independent queries, each with a
 * 2 s budget; a failed or slow one is `null` and the others still answer (the header shows that panel as unavailable).
 * 401 without a session, with no detail.
 */
export const GET = handle('/api/account/summary', async () => {
  const { customerId } = await requireCustomer();
  const [openOrders, readyForCollection, savedItems] = await Promise.all([
    withBudget(countOrders(customerId, 'in-progress')),
    withBudget(countOrders(customerId, 'ready')),
    withBudget(findList(customerId).then((list) => list?.lineItems.length ?? 0)),
  ]);
  const body: AccountSummary = { openOrders, readyForCollection, savedItems };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
});
