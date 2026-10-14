// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { cartActions } from '@/hooks/cart-actions';
import { fetchJson } from '@/hooks/fetch-json';
import { KEY_CART, KEY_CART_SUMMARY } from '@/lib/cache-keys';
import { applyQuantity, applyRemoval } from '@/lib/cart-optimistic';
import type { Cart, CartResponse, DeliveryMode, PromoCodeState } from '@/lib/types';

export type CartNotice = 'capped' | 'out-of-stock';

export interface UseCart {
  /** Null without a cart (empty state). */
  cart: Cart | null;
  isLoading: boolean;
  /** Units, not lines ("Cart · 3" for 2 plus 1). */
  itemCount: number;
  /** Set by the last change when the server lowered a quantity to the stock. */
  notice: CartNotice | null;
  /** A change failed and was rolled back. */
  error: boolean;
  /** The state of the code the shopper typed last (a refused code is not in the cart). */
  lastPromo: PromoCodeState | null;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  setDelivery: (mode: DeliveryMode) => Promise<void>;
  applyCode: (code: string) => Promise<void>;
  removeCode: (id: string) => Promise<void>;
}

const readCart = async (url: string): Promise<Cart | null> => {
  try {
    return (await fetchJson<CartResponse>(url)).cart;
  } catch {
    return null; // a failed read shows the empty cart, the header badge never blocks the page
  }
};

/**
 * The cart behind the cart page (workstream N). SWR key `KEY_CART`; `initialCart` (read on the server) is the first value and avoids a
 * second request. Every change writes the server's answer into the cache without a refetch (D15); quantity changes and removals show at
 * once and roll back on failure. The header count (`KEY_CART_SUMMARY`) follows the cart.
 */
export function useCart(initialCart?: Cart | null): UseCart {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useSWR<Cart | null>(KEY_CART, readCart, {
    fallbackData: initialCart,
    revalidateOnMount: initialCart === undefined,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  const cart = data ?? null;
  const [notice, setNotice] = useState<CartNotice | null>(null);
  const [error, setError] = useState(false);
  const [lastPromo, setLastPromo] = useState<PromoCodeState | null>(null);
  const promo = useRef<PromoCodeState | null>(null);
  // `fallbackData` is not in the cache, so a change starts from what is on screen, not from the cache entry.
  const shown = useRef<Cart | null>(cart);
  useEffect(() => {
    shown.current = cart;
  }, [cart]);

  // The header badge shows the units of this cart, also while a change is still on its way.
  const count = cart?.itemCount ?? 0;
  const loaded = data !== undefined;
  useEffect(() => {
    if (loaded) void globalMutate(KEY_CART_SUMMARY, { count }, { revalidate: false });
  }, [count, loaded, globalMutate]);

  const run = useCallback(
    async (request: () => Promise<CartResponse>, optimistic?: (current: Cart) => Cart) => {
      setError(false);
      setNotice(null);
      promo.current = null;
      try {
        await mutate(
          async () => {
            const response = await request();
            setNotice(response.notice ?? null);
            promo.current = response.promo ?? null;
            return response.cart;
          },
          { optimisticData: optimistic ? () => (shown.current ? optimistic(shown.current) : null) : undefined, rollbackOnError: true, populateCache: true, revalidate: false },
        );
        setLastPromo(promo.current);
      } catch {
        setError(true);
      }
    },
    [mutate],
  );

  return {
    cart,
    isLoading,
    itemCount: count,
    notice,
    error,
    lastPromo,
    setQuantity: (lineId, quantity) => run(() => cartActions.setQuantity(lineId, quantity), (current) => applyQuantity(current, lineId, quantity)),
    removeLine: (lineId) => run(() => cartActions.removeLine(lineId), (current) => applyRemoval(current, lineId)),
    setDelivery: (mode) => run(() => cartActions.setDelivery(mode)),
    applyCode: (code) => run(() => cartActions.applyCode(code)),
    removeCode: async (id) => {
      setLastPromo(null);
      await run(() => cartActions.removeCode(id));
    },
  };
}
