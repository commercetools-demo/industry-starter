'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { KEY_CART } from '@/lib/cache-keys';
import type { CartSummary } from '@/lib/types';

/**
 * The shopper's cart (`null` without one). Minimal in workstream G (CartSummary: id, version, count, lines);
 * workstream I extends it to the full cart and keeps these fields. Mutate with `mutate(KEY_CART, cart, { revalidate: false })`.
 */
export function useCart() {
  const { data, error, isLoading, mutate } = useSWR<{ cart: CartSummary | null }>(
    KEY_CART,
    () => jsonFetcher<{ cart: CartSummary | null }>('/api/cart'),
    { revalidateOnFocus: true },
  );
  return { cart: data?.cart ?? null, isLoading, error: error as unknown, mutate };
}
