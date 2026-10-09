import 'server-only';
import { apiRoot } from './client';

/** True while a colleague still has the one-time password an administrator gave them (set at invitation). */
export async function mustChangePassword(customerId: string): Promise<boolean> {
  const customer = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  return customer.custom?.fields?.mustChangePassword === true;
}

/** Called after a successful password change; a no-op for customers who never had the flag. */
export async function clearMustChangePassword(customerId: string): Promise<void> {
  const customer = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  if (customer.custom?.fields?.mustChangePassword !== true) return;
  await apiRoot.customers().withId({ ID: customerId }).post({ body: { version: customer.version, actions: [{ action: 'setCustomField', name: 'mustChangePassword', value: false }] } }).execute();
}
