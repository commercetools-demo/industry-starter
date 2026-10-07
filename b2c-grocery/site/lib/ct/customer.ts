import 'server-only';
import type { Customer as CtCustomer } from '@commercetools/platform-sdk';
import { getApiRoot } from './client';

/** The customer, or `null` when it does not exist (deleted after the session was issued). */
export async function getCustomer(customerId: string): Promise<CtCustomer | null> {
  try {
    return (await getApiRoot().customers().withId({ ID: customerId }).get().execute()).body;
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { statusCode?: unknown }).statusCode === 404) return null;
    throw e;
  }
}
