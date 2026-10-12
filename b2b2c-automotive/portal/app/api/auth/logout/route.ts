// POST /api/auth/logout: clears the session cookie (R-06).
import { handle, json } from '@/lib/portal/route-kit';
import { clearSession } from '@/lib/portal/seam';

export const POST = handle(async () => {
  await clearSession();
  return json({ status: 'signed-out' });
});
