'use client';
import useSWR, { type SWRResponse } from 'swr';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import type { AccountUser } from '@/lib/types';

/**
 * Signed-in user. Placeholder: reads the SWR cache only (seeded by the root layout fallback) and
 * calls no endpoint yet; the account workstream passes a fetcher built on `API_ACCOUNT`.
 * `null` or undefined means signed out.
 */
export function useAccount(): SWRResponse<AccountUser | null> {
  return useSWR<AccountUser | null>(KEY_ACCOUNT, null);
}
