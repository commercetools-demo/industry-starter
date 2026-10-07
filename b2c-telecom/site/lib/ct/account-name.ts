import 'server-only';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

/**
 * First name of the signed-in customer for the header greeting. The id always comes from the signed session (D-070).
 * Never cached (it is per buyer). Any failure returns '' so the header falls back to "My account" instead of failing the page.
 */
export async function getAccountFirstName(customerId: string): Promise<string> {
  try {
    const { body } = await withTimeout(getApiRoot().customers().withId({ ID: customerId }).get().execute(), 'customers.firstName');
    return body.firstName?.trim() ?? '';
  } catch (error) {
    console.error('[shell] customer name unavailable', error instanceof Error ? error.name : 'unknown');
    return '';
  }
}
