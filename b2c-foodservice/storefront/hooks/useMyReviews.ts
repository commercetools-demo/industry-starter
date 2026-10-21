'use client';

import useSWR from 'swr';
import { useAccount } from '@/hooks/useAccount';
import { fetchJson } from '@/hooks/fetcher';
import { keyMyReviews } from '@/lib/cache-keys';
import type { MyReviewView } from '@/lib/types';

/** The signed-in customer's own reviews (account Reviews tab). Safe defaults: an empty list while loading or on error. */
export function useMyReviews() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { data, error, isLoading, mutate } = useSWR<{ reviews: MyReviewView[] }>(
    customerId ? keyMyReviews(customerId) : null,
    () => fetchJson<{ reviews: MyReviewView[] }>('/api/reviews?mine=1'),
    { revalidateOnFocus: false },
  );
  return { reviews: data?.reviews ?? [], isLoading, isError: Boolean(error), mutate, customerId };
}
