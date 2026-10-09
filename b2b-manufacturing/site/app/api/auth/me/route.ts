import { handle, ok } from '@/lib/api';
import { getSession } from '@/lib/session';

/** The signed-in account, or `null` (status 200, so anonymous visitors see no error in the console). */
export const GET = handle(async () => {
  const s = await getSession();
  if (!s.customerId) return ok(null);
  return ok({ customerId: s.customerId, email: s.customerEmail ?? '', firstName: s.customerFirstName, lastName: s.customerLastName, businessUnitKey: s.businessUnitKey ?? null });
});
