import 'server-only';
import { unstable_cache } from 'next/cache';
import { CUSTOMER_GROUPS_TTL } from '@/lib/config/cache';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

// Session-free on purpose: a cached function must never read the session (see no-session-in-cache.test.ts).

/** Customer Group id to key, shared by every buyer (project data, not buyer data). */
export async function getCustomerGroupKeys(): Promise<Record<string, string>> {
  const read = unstable_cache(
    async (): Promise<Record<string, string>> => {
      const { body } = await withTimeout(getApiRoot().customerGroups().get({ queryArgs: { limit: 100 } }).execute(), 'customer-groups');
      const keys: Record<string, string> = {};
      for (const group of body.results) if (group.key) keys[group.id] = group.key;
      return keys;
    },
    ['customer-group-keys'],
    { revalidate: CUSTOMER_GROUPS_TTL, tags: ['customer-groups'] },
  );
  return read();
}
