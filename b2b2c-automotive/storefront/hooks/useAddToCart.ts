// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { HttpError, postJson } from '@/hooks/fetch-json';
import { KEY_CART } from '@/lib/cache-keys';

export type AddToCartError = 'price-unavailable' | 'failed';

/**
 * Adds a sku to the cart through `POST /api/cart/lines` (workstream L; M and N reuse and extend it). `add` resolves to whether the
 * line was added; on success every cart read (header badge included) is refreshed. `error` is `price-unavailable` for a 422
 * and `failed` for anything else, `null` after a successful add.
 */
export function useAddToCart(): { add: (sku: string, quantity: number, options?: { recurrencePolicyKey?: string }) => Promise<boolean>; isAdding: boolean; error: AddToCartError | null } {
  const { mutate } = useSWRConfig();
  const [isAdding, setAdding] = useState(false);
  const [error, setError] = useState<AddToCartError | null>(null);

  const add = useCallback(
    async (sku: string, quantity: number, options?: { recurrencePolicyKey?: string }) => {
      setAdding(true);
      setError(null);
      try {
        await postJson<{ cartId: string; count: number }>('/api/cart/lines', { sku, quantity, ...(options?.recurrencePolicyKey ? { recurrencePolicyKey: options.recurrencePolicyKey } : {}) });
        await mutate((key) => typeof key === 'string' && key.startsWith(KEY_CART));
        return true;
      } catch (e) {
        setError(e instanceof HttpError && e.status === 422 ? 'price-unavailable' : 'failed');
        return false;
      } finally {
        setAdding(false);
      }
    },
    [mutate],
  );

  return { add, isAdding, error };
}
