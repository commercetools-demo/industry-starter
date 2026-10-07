import 'server-only';
import { cache } from 'react';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

async function readFirstName(customerId: string): Promise<string> {
  try {
    const { body } = await withTimeout(getApiRoot().customers().withId({ ID: customerId }).get().execute(), 'customers.firstName');
    return body.firstName?.trim() ?? '';
  } catch (error) {
    console.error('[shell] customer name unavailable', error instanceof Error ? error.name : 'unknown');
    return '';
  }
}

/**
 * First name of the signed-in customer for the header greeting. The id always comes from the signed session (D-070).
 * Deduplicated within one request only (React `cache`: the header and the mobile drawer both render it); never shared
 * across requests because it is per buyer. Any failure returns '' so the header falls back to "My account".
 */
export const getAccountFirstName: (customerId: string) => Promise<string> = cache(readFirstName);
