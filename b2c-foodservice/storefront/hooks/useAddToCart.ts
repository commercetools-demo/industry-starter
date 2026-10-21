'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { ApiError, fetchJson } from '@/hooks/fetcher';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';
import type { CartSummary } from '@/lib/types';

export interface AddToCartInput {
  sku: string;
  quantity: number;
  /** Only `delivery` is built in workstream G; H adds `collect` and `subscribe` (with `storeKey` / `recurrencePolicyKey`). */
  fulfilment: 'delivery' | 'collect' | 'subscribe';
  storeKey?: string;
  recurrencePolicyKey?: string;
}

/**
 * Adds a line through POST /api/cart/lines. On success the cart cache (KEY_CART) and the header badge (KEY_CART_COUNT)
 * are set from the response body, with no refetch. `add` resolves to the cart, or null after setting `error`.
 */
export function useAddToCart() {
  const { mutate } = useSWRConfig();
  const [isAdding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (input: AddToCartInput): Promise<CartSummary | null> => {
      setAdding(true);
      setError(null);
      try {
        const res = await fetchJson<{ cart: CartSummary }>('/api/cart/lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        await Promise.all([
          mutate(KEY_CART, { cart: res.cart }, { revalidate: false }),
          mutate(KEY_CART_COUNT, { count: res.cart.count }, { revalidate: false }),
        ]);
        return res.cart;
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'internal_error');
        return null;
      } finally {
        setAdding(false);
      }
    },
    [mutate],
  );

  return { add, isAdding, error };
}
