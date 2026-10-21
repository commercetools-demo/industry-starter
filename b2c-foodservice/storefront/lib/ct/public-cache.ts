import 'server-only';
import { unstable_cache } from 'next/cache';
import { TAG, TTL } from '@/lib/cache-keys';

/**
 * The only place unstable_cache is called. Public, non-personalised data only:
 * never carts, accounts, orders, session-bound availability or prices.
 * Arguments are strings and numbers by type so a session object cannot be passed by accident.
 */
export function cachedPublic<A extends readonly (string | number)[], R>(
  kind: keyof typeof TTL,
  keyParts: readonly string[],
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, [...keyParts], { revalidate: TTL[kind], tags: [TAG[kind]] });
}
