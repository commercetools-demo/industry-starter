import { handle } from '@/lib/api';
import { toAccountUser } from '@/lib/auth-route';
import { getCustomerById, logout } from '@/lib/ct/identity';
import { getSession } from '@/lib/session';

/**
 * GET /api/auth/me: the minimal signed-in user (id, first and last name for the initials, email), or `null`
 * when signed out. A session whose customer no longer exists is signed out on the spot.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await getSession();
    if (!customerId) return null;
    const user = await getCustomerById(customerId);
    if (!user) {
      await logout();
      return null;
    }
    return toAccountUser(user);
  });
}
