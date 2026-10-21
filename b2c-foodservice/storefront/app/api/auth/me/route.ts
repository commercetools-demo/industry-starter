import { handle } from '@/lib/api';
import { getCustomerById } from '@/lib/ct/auth';
import { toAppCustomer } from '@/lib/mappers/customer';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me -> 200 { customer: AppCustomer | null }. Never 401; null also when the lookup fails. */
export const GET = handle('/api/auth/me', async () => {
  const { customerId } = await getSession();
  if (!customerId) return Response.json({ customer: null });
  try {
    return Response.json({ customer: toAppCustomer(await getCustomerById(customerId)) });
  } catch {
    return Response.json({ customer: null });
  }
});
