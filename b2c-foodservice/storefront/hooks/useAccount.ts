'use client';

import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { KEY_ACCOUNT } from '@/lib/cache-keys';

export interface AccountSummary { firstName: string; lastName: string; email: string }

/**
 * The signed-in customer for the header, from GET /api/auth/me (built by J): `{ customer: { firstName, lastName, email } | null }`.
 * Returns `customer: null` for a guest and on any failure. Sign out with POST /api/auth/logout, then `mutate(KEY_ACCOUNT)`.
 */
export function useAccount() {
  const { data, mutate, isLoading } = useSWR<{ customer: AccountSummary | null }>(
    KEY_ACCOUNT,
    async () => {
      try {
        return await fetchJson<{ customer: AccountSummary | null }>('/api/auth/me');
      } catch {
        return { customer: null };
      }
    },
    { revalidateOnFocus: false },
  );
  return { customer: data?.customer ?? null, isLoading, mutate };
}
