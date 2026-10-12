import 'server-only';
import { apiRoot } from '@/lib/ct/client';

/** Display name and email of the signed-in customer (frontend client). */
export async function getCustomerIdentity(customerId: string): Promise<{ name: string; email: string }> {
  const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
  const name = [body.firstName, body.lastName].filter(Boolean).join(' ') || body.email;
  return { name, email: body.email };
}
