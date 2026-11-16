'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { ApiError, fetchJson } from '@/hooks/fetcher';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';
import type { CartSummary } from '@/lib/types';

export interface AddPresetBundleInput {
  sku: string;
  preset: number;
  quantity: number;
  /** The chosen machine variant (D-059); omitted means the default machine. */
  machineSku?: string;
  fulfilment: 'delivery' | 'collect';
  storeKey?: string;
}

/**
 * Adds a preset bundle through POST /api/cart/bundles (workstream V). The body carries no price. On success the header badge
 * and the full cart are updated, as for `useAddToCart`. `add` resolves to the cart, or null after setting `error` (a code).
 */
export function useAddPresetBundle() {
  const { mutate } = useSWRConfig();
  const [isAdding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (input: AddPresetBundleInput): Promise<CartSummary | null> => {
      setAdding(true);
      setError(null);
      try {
        const res = await fetchJson<{ cart: CartSummary }>('/api/cart/bundles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
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
