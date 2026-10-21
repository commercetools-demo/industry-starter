'use client';

import { useLocale } from 'next-intl';
import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { KEY_RECURRENCE_POLICIES } from '@/lib/cache-keys';
import type { RecurrencePolicyView } from '@/lib/types';

/**
 * The recurrence policies (delivery intervals), public and stable, so the data is fetched once and kept for five minutes.
 * The product page gets its list from the server render; this hook is for the bag and subscription screens (I, K, N)
 * that let the shopper change an interval. `data` is undefined while loading.
 */
export function useRecurrencePolicies() {
  const locale = useLocale();
  return useSWR<{ policies: RecurrencePolicyView[] }>(
    [KEY_RECURRENCE_POLICIES, locale] as const,
    () => jsonFetcher<{ policies: RecurrencePolicyView[] }>(`/api/recurrence-policies?locale=${encodeURIComponent(locale)}`),
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
}
