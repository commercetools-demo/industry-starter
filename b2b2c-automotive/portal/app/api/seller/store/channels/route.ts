// GET /api/seller/store/channels?storeKey= (workstream U-05): orders, revenue and share per sales channel for the last 30 days.
import { loadChannelStats } from '@/lib/ct/seller/channel-stats';
import { json } from '@/lib/portal/route-kit';
import { authorizeQuery, storeHandle } from '@/lib/portal/store-route';

export const GET = storeHandle(async (request: Request) => {
  const { storeKey } = await authorizeQuery(request, 'store.view-performance');
  return json(await loadChannelStats(storeKey, 30));
});
