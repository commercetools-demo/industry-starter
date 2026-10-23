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
 * Adds a line through POST /api/cart/lines. On success the header badge (KEY_CART_COUNT) is set from the response body
 * and the full cart (KEY_CART, workstream I) is revalidated. `add` resolves to the cart, or null after setting `error`.
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
        // The response is a CartSummary; the full cart (drawer, page) is read again, the badge is set at once.
        await Promise.all([
          mutate(KEY_CART),
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
