import 'server-only';
import { getCustomerById } from '@/lib/ct/auth';
import { getSession } from '@/lib/session';

/** True when the session names a customer that still resolves in commercetools. Never throws. */
export async function hasSignedInCustomer(): Promise<boolean> {
  const { customerId } = await getSession();
  if (!customerId) return false;
  try {
    await getCustomerById(customerId);
    return true;
  } catch {
    return false;
  }
}
