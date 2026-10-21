'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { ApiError, fetchJson } from '@/hooks/fetcher';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';
import type { Cart } from '@/lib/types';

/** Key of `isPending` for changes that are not about one line (codes, store change). */
export const CART_PENDING = '*';

export type SwitchTarget = { fulfilment: 'delivery' } | { fulfilment: 'collect'; storeKey?: string };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Cart writes for the drawer and the page (workstream I). Every call resolves to the cart the server returned (engine totals)
 * and has already put it into `KEY_CART` and the badge (`KEY_CART_COUNT`), with no refetch and no optimistic value. A failure
 * throws `ApiError` and leaves the previous cart in place; the exceptions are a refused discount code (the unchanged cart
 * from `details.cart` replaces the cached one) and a conflict (the cart is read again). `isPending(lineId)` is true while
 * that line's request is in flight; `isPending(CART_PENDING)` covers codes and the store change.
 */
export function useCartMutations() {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const publish = useCallback(
    async (cart: Cart) => {
      await Promise.all([
        mutate(KEY_CART, { cart }, { revalidate: false }),
        mutate(KEY_CART_COUNT, { count: cart.count }, { revalidate: false }),
      ]);
    },
    [mutate],
  );

  const send = useCallback(
    async (key: string, url: string, method: 'PATCH' | 'DELETE', body?: unknown): Promise<Cart> => {
      setPending((p) => new Set(p).add(key));
      try {
        const res = await fetchJson<{ cart: Cart }>(url, {
          method,
          ...(body === undefined ? {} : { headers: JSON_HEADERS, body: JSON.stringify(body) }),
        });
        await publish(res.cart);
        return res.cart;
      } catch (e) {
        if (e instanceof ApiError) {
          const fresh = (e.extra.details as { cart?: Cart } | undefined)?.cart;
          if (fresh) await publish(fresh);
          else if (e.code === 'conflict') await mutate(KEY_CART);
        }
        throw e;
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(key);
          return next;
        });
      }
    },
    [mutate, publish],
  );

  const line = (id: string) => `/api/cart/lines/${encodeURIComponent(id)}`;

  return {
    setQuantity: useCallback((lineId: string, quantity: number) => send(lineId, line(lineId), 'PATCH', { quantity }), [send]),
    remove: useCallback((lineId: string) => send(lineId, line(lineId), 'DELETE'), [send]),
    switchFulfilment: useCallback((lineId: string, target: SwitchTarget) => send(lineId, line(lineId), 'PATCH', target), [send]),
    changeStore: useCallback((storeKey: string) => send(CART_PENDING, '/api/cart', 'PATCH', { action: 'changeCollectionStore', storeKey }), [send]),
    applyCode: useCallback((code: string) => send(CART_PENDING, '/api/cart', 'PATCH', { action: 'applyDiscountCode', code }), [send]),
    removeCode: useCallback((id: string) => send(CART_PENDING, '/api/cart', 'PATCH', { action: 'removeDiscountCode', id }), [send]),
    isPending: useCallback((key: string) => pending.has(key), [pending]),
    anyPending: pending.size > 0,
  };
}
