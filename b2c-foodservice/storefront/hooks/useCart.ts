'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { KEY_CART } from '@/lib/cache-keys';
import type { Cart } from '@/lib/types';

/**
 * The shopper's full cart (`null` without one): lines, groups, engine totals, codes, notices (workstream I). Revalidates on
 * focus. `enabled: false` reads nothing (the drawer waits until it is opened). On the cart page the server passes `initialCart` so there is no loading flash. Write with `useCartMutations`, which
 * sets this key from each response body (`mutate(KEY_CART, { cart }, { revalidate: false })`); never patch it by hand.
 */
export function useCart(options: { initialCart?: Cart | null; enabled?: boolean } = {}) {
  const { initialCart, enabled = true } = options;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ cart: Cart | null }>(
    enabled ? KEY_CART : null,
    () => jsonFetcher<{ cart: Cart | null }>('/api/cart'),
    {
      revalidateOnFocus: true,
      // The server just read the cart: no refetch on mount (a late answer could overwrite a faster write). Focus still revalidates.
      ...(initialCart !== undefined ? { fallbackData: { cart: initialCart }, revalidateOnMount: false } : {}),
    },
  );
  // With a seeded or cached cart there is nothing to wait for (a background refresh is `isValidating`).
  return { cart: data?.cart ?? null, isLoading: isLoading && data === undefined, isValidating, error: error as unknown, mutate };
}
