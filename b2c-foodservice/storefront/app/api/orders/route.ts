import { handle, requireCustomer } from '@/lib/api';
import { listOrders } from '@/lib/ct/account-orders';
import { AppError } from '@/lib/errors';
import { mapOrderListItem } from '@/lib/mappers/account-order';
import { getMarket } from '@/lib/session';
import type { OrderFilter } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FILTERS: readonly OrderFilter[] = ['all', 'in-progress', 'ready', 'completed'];

function int(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^\d{1,6}$/.test(value)) throw new AppError('bad_request', 400);
  const n = Number(value);
  if (n < min || n > max) throw new AppError('bad_request', 400);
  return n;
}

/**
 * GET /api/orders?filter=all|in-progress|ready|completed&limit=10&offset=0
 * -> 200 { orders: OrderListItem[], total, limit, offset }, newest first, the whole history paged (limit 1 to 50).
 * The customer is always the session's: a `customerId` in the query is ignored. 400 bad_request on a bad query; 401 with no detail.
 */
export const GET = handle('/api/orders', async (req) => {
  const { customerId } = await requireCustomer();
  const params = new URL(req.url).searchParams;
  const filter = (params.get('filter') ?? 'all') as OrderFilter;
  if (!FILTERS.includes(filter)) throw new AppError('bad_request', 400);
  const limit = int(params.get('limit'), 10, 1, 50);
  const offset = int(params.get('offset'), 0, 0, 100000);
  const [{ results, total }, market] = await Promise.all([listOrders(customerId, { filter, limit, offset }), getMarket()]);
  return Response.json(
    { orders: results.map((o) => mapOrderListItem(o, market.locale)), total, limit, offset },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
