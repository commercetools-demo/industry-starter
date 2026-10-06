import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { getCustomer } from '@/lib/ct/customer';
import { mapProfile } from '@/lib/mappers/customer';
import { getSession } from '@/lib/session';

/** `{ createdAt, firstName, lastName, email, defaultShippingAddress? }` for the dashboard cards. */
export async function GET() {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  try {
    const customer = await getCustomer(customerId);
    if (!customer) return privateJson({ error: 'CUSTOMER_NOT_FOUND' }, { status: 404 });
    return privateJson(mapProfile(customer));
  } catch (e) {
    console.error('Profile request failed', e instanceof Error ? e.message : e);
    return privateJson({ error: 'PROFILE_ERROR' }, { status: 500 });
  }
}
