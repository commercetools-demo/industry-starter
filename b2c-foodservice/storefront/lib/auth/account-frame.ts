import 'server-only';
import { getSession } from '@/lib/session';

/** What the account frame shows: the signed-in customer's first name, or null for a guest (no data is rendered then). */
export async function getAccountFrame(): Promise<{ customerId: string; firstName: string } | null> {
  const { customerId, customerFirstName } = await getSession();
  return customerId ? { customerId, firstName: customerFirstName ?? '' } : null;
}
