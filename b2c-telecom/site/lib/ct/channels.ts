import 'server-only';
import { unstable_cache } from 'next/cache';
import { CUSTOMER_GROUPS_TTL } from '@/lib/config/cache';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

// Session-free on purpose: a cached function must never read the session (see no-session-in-cache.test.ts).

/** Channel id to key, shared by every buyer (embedded prices reference a channel by id). */
export async function getChannelKeys(): Promise<Record<string, string>> {
  const read = unstable_cache(
    async (): Promise<Record<string, string>> => {
      const { body } = await withTimeout(getApiRoot().channels().get({ queryArgs: { limit: 100 } }).execute(), 'channels');
      const keys: Record<string, string> = {};
      for (const channel of body.results) keys[channel.id] = channel.key;
      return keys;
    },
    ['channel-keys'],
    { revalidate: CUSTOMER_GROUPS_TTL, tags: ['channels'] },
  );
  return read();
}
