'use client';

import { useCallback, useEffect, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetchJson } from '@/hooks/fetcher';
import { keyReviews } from '@/lib/cache-keys';
import type { ReviewPageResponse, ReviewSort, ReviewView } from '@/lib/types';

type ReviewKey = ReturnType<typeof keyReviews>;

/**
 * SWR's global `mutate(filter)` skips infinite keys, so each mounted list registers its own `mutate` here and the actions
 * hook calls `revalidateReviewLists(productId)` after a write (the first page and any further loaded page refresh).
 */
const mounted = new Set<{ productId: string; revalidate: () => Promise<unknown> }>();
export async function revalidateReviewLists(productId: string | null): Promise<void> {
  await Promise.all([...mounted].filter((m) => productId === null || m.productId === productId).map((m) => m.revalidate()));
}

/**
 * The public review list of one product, five per page (workstream M). Pages are keyed with `keyReviews(productId, sort, page)`;
 * changing the sort changes the first key, so the list starts again at page 0. Safe defaults on error: an empty list.
 */
export function useReviews(productId: string, sort: ReviewSort) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<ReviewPageResponse, Error, (index: number, prev: ReviewPageResponse | null) => ReviewKey | null>(
    (index, previous) => (previous && !previous.hasMore ? null : keyReviews(productId, sort, index)),
    ([, id, s, page]: ReviewKey) =>
      fetchJson<ReviewPageResponse>(`/api/reviews?productId=${encodeURIComponent(id)}&sort=${s}&page=${page}`),
    { revalidateOnFocus: false, revalidateFirstPage: false },
  );

  useEffect(() => {
    const entry = { productId, revalidate: () => mutate() };
    mounted.add(entry);
    return () => {
      mounted.delete(entry);
    };
  }, [productId, mutate]);

  const reviews = useMemo<ReviewView[]>(() => (data ?? []).flatMap((p) => p.reviews), [data]);
  const last = data?.[data.length - 1];
  const loadingMore = isValidating && size > (data?.length ?? 0);
  const loadMore = useCallback(async () => {
    await setSize((n) => n + 1);
  }, [setSize]);
  return {
    reviews,
    total: data?.[0]?.total ?? 0,
    mine: data?.[0]?.mine ?? null,
    hasMore: last?.hasMore ?? false,
    isLoading,
    isLoadingMore: loadingMore,
    isError: Boolean(error) && reviews.length === 0,
    loadMore,
    mutate,
  };
}
