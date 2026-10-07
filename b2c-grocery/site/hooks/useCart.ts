'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import { fetchJson, sendJson } from '@/lib/fetcher';
import type { Cart, SubstitutionPreference } from '@/lib/types';

type CartResponse = { cart: Cart | null };

/** The session cart; `null` (never `undefined`) once loaded and when there is none. Revalidates on focus. */
export function useCart() {
  const swr = useSWR<Cart | null>(KEY_CART, async () => (await fetchJson<CartResponse>('/api/cart')).cart, { revalidateOnFocus: true });
  return { ...swr, cart: swr.data ?? null };
}

export interface AddItemOptions { recurrencePolicyKey?: string }

/**
 * Cart mutations. Each one writes the cart from the response body into the cache (no refetch) and returns it.
 * On failure it throws `ApiError` (e.g. status 409, `data.available`) and the cache is left untouched.
 */
export function useCartMutations() {
  const { mutate } = useSWRConfig();

  const apply = useCallback(
    async (request: Promise<CartResponse>): Promise<Cart | null> => {
      const { cart } = await request;
      await mutate(KEY_CART, cart, { revalidate: false });
      return cart;
    },
    [mutate],
  );

  const addItem = useCallback(
    (sku: string, quantity: number, options: AddItemOptions = {}) =>
      apply(sendJson<CartResponse>('/api/cart/line-items', 'POST', { sku, quantity, ...(options.recurrencePolicyKey ? { recurrencePolicyKey: options.recurrencePolicyKey } : {}) })),
    [apply],
  );
  const setQuantity = useCallback(
    (lineId: string, quantity: number) => apply(sendJson<CartResponse>(`/api/cart/line-items/${encodeURIComponent(lineId)}`, 'PATCH', { quantity })),
    [apply],
  );
  const removeLine = useCallback(
    (lineId: string) => apply(sendJson<CartResponse>(`/api/cart/line-items/${encodeURIComponent(lineId)}`, 'DELETE')),
    [apply],
  );

  const setSubstitution = useCallback(
    (lineId: string, preference: SubstitutionPreference) =>
      apply(sendJson<CartResponse>(`/api/cart/line-items/${encodeURIComponent(lineId)}/substitution`, 'PATCH', { preference })),
    [apply],
  );

  return useMemo(() => ({ addItem, setQuantity, removeLine, setSubstitution }), [addItem, setQuantity, removeLine, setSubstitution]);
}
