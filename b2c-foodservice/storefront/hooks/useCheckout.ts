'use client';

import { useCallback, useEffect, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ApiError, fetchJson, jsonFetcher } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { KEY_CART, KEY_CART_COUNT, keyCheckout } from '@/lib/cache-keys';
import type { Cart, CheckoutState } from '@/lib/types';

export interface HostedSession {
  sessionId: string;
  projectKey: string;
  region: string;
  orderNumber: string;
  expiresAt: string | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * The checkout state and its writes (workstream K). `state` is read from `GET /api/checkout` and replaced by each response;
 * totals are never computed here. It is re-read when the bag changes elsewhere (the store picker moves the collect lines through
 * the cart hooks and writes `KEY_CART`). Never revalidated on focus: the pay stage must not reload under the shopper.
 */
export function useCheckout(options: { resume?: boolean } = {}) {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const key = keyCheckout(customerId);
  const { mutate: mutateGlobal } = useSWRConfig();
  const url = options.resume ? '/api/checkout?resume=1' : '/api/checkout';
  const { data, error, isLoading, mutate } = useSWR<CheckoutState>(key, () => jsonFetcher<CheckoutState>(url), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  // The bag changed elsewhere (store change from the picker): read the state again.
  const { data: cartData } = useSWR<{ cart: Cart | null }>(KEY_CART);
  const version = cartData?.cart?.version;
  const seen = useRef<number | undefined>(version);
  useEffect(() => {
    if (version !== undefined && seen.current !== undefined && version !== seen.current) void mutate();
    seen.current = version;
  }, [version, mutate]);

  const savePickup = useCallback(
    async (input: { person?: 'me' | 'other'; pickupName?: string }): Promise<CheckoutState> => {
      const next = await fetchJson<CheckoutState>('/api/checkout/pickup', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(input) });
      await mutate(next, { revalidate: false });
      return next;
    },
    [mutate],
  );

  const createSession = useCallback(
    (expectedTotalCents: number, part: number): Promise<HostedSession> =>
      fetchJson<HostedSession>('/api/checkout/session', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ expectedTotalCents, part }) }),
    [],
  );

  /** After the hosted flow reports completion. `next` is the payment still to make (complete-per-group) or null when the purchase is complete. */
  const complete = useCallback(
    async (part: number): Promise<{ orderId: string; next: number | null }> => {
      const res = await fetchJson<{ orderId: string; next: number | null }>('/api/checkout/complete', {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ part }),
      });
      if (res.next === null) {
        // The bag is gone: evict every key that held it.
        await Promise.all([
          mutateGlobal(KEY_CART, { cart: null }, { revalidate: false }),
          mutateGlobal(KEY_CART_COUNT, { count: 0 }, { revalidate: false }),
          mutate(undefined, { revalidate: false }),
        ]);
      } else {
        await Promise.all([mutateGlobal(KEY_CART), mutate()]);
      }
      return res;
    },
    [mutate, mutateGlobal],
  );

  return {
    state: data,
    error: error as ApiError | undefined,
    isLoading: isLoading && data === undefined,
    reload: () => mutate(),
    savePickup,
    createSession,
    complete,
  };
}
