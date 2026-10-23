'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { KEY_CART_COUNT } from '@/lib/cache-keys';

/**
 * Units in the bag for the header badge. 0 while loading and on any failure (the badge is then hidden, no error shown).
 * Workstream I replaces the source with `useCart()` but keeps this export. Call `mutate(KEY_CART_COUNT)` after a cart write.
 */
export function useCartCount(): number {
  const { data } = useSWR<{ count: number }>(KEY_CART_COUNT, () => jsonFetcher<{ count: number }>('/api/cart/count'), {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  return data?.count ?? 0;
}
