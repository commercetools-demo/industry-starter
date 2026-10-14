// GET /api/notifications: notifications of the signed-in associate's store (R-14). Dismissals live in the browser (Q-R04).
import { loadNotifications } from '@/lib/portal/notification-sources';
import { ApiError, handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { readSession } from '@/lib/portal/seam';

export const GET = handle(async () => {
  const session = await readSession();
  requireCustomer(session);
  if (!session.businessUnitKey || session.pending) throw new ApiError(400, 'No active business unit');
  return json({ notifications: await loadNotifications(session) });
});
