'use client';

import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyAccountSummary } from '@/lib/cache-keys';
import type { AccountSummary } from '@/lib/types';

/** Counts for the account header. Each count is `null` when its own query failed; `isError` means the whole call failed. */
export function useAccountSummary() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { data, error, isLoading, mutate } = useAccountSwr<AccountSummary>(
    customerId ? keyAccountSummary(customerId) : null,
    '/api/account/summary',
  );
  return { summary: data ?? null, isLoading, isError: Boolean(error), mutate, customerId };
}
