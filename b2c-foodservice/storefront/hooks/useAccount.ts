'use client';

import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import type { AppCustomer } from '@/lib/types';

/**
 * The signed-in customer from GET /api/auth/me. `customer` is `undefined` while loading, `null` for a guest and on any
 * failure, otherwise the customer. Sign in, register and sign out go through `useAuthActions()`.
 */
export function useAccount() {
  const { data, mutate, isLoading } = useSWR<{ customer: AppCustomer | null }>(
    KEY_ACCOUNT,
    async () => {
      try {
        return await fetchJson<{ customer: AppCustomer | null }>('/api/auth/me');
      } catch {
        return { customer: null };
      }
    },
    { revalidateOnFocus: false },
  );
  const customer: AppCustomer | null | undefined = data === undefined ? undefined : data.customer;
  return { customer, isLoading, mutate };
}
