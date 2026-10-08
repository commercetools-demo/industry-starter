import 'server-only';
import { cache } from 'react';
import { apiRoot } from '@/lib/ct/client';
import type { AccountUser } from '@/lib/types';

/** One customer by id (per-patient, so never wrapped in `unstable_cache`); null when it no longer exists. */
export async function getCustomerById(customerId: string): Promise<AccountUser | null> {
  try {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    return { id: body.id, firstName: body.firstName, lastName: body.lastName };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

/** One read per request for every page that shows the display name (the cookie has ids only). */
export const getCustomerByIdCached = cache(getCustomerById);
