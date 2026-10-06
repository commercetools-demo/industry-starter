'use client';

import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_CART, KEY_ORDERS } from '@/lib/cache-keys';
import { ApiError, sendJson } from '@/lib/fetcher';

export interface CheckoutSessionBody {
  sessionId: string;
  projectKey: string;
  region: string;
}

/** Never throws on API answers; `error` is an API error code (`SLOT_FULL`, `UNAVAILABLE_LINES`, ...) or `NETWORK`. */
export type StartResult = { ok: true; session: CheckoutSessionBody } | { ok: false; error: string };
export type CompleteResult = { ok: true; orderId: string } | { ok: false; error: string };

const errorCode = (e: unknown): string => (e instanceof ApiError ? e.message : 'NETWORK');

/** The two calls of the hosted checkout hand-off (components never call `/api` directly). */
export function useCheckoutSession() {
  const { mutate } = useSWRConfig();

  /** Creates the session. A failure refreshes the cart cache (the server may have cleared the slot). */
  const start = useCallback(async (): Promise<StartResult> => {
    try {
      return { ok: true, session: await sendJson<CheckoutSessionBody>('/api/checkout/session', 'POST') };
    } catch (e) {
      await mutate(KEY_CART);
      return { ok: false, error: errorCode(e) };
    }
  }, [mutate]);

  /** Tells the server the order exists, then empties the bag and the order list caches. */
  const complete = useCallback(
    async (orderId: string): Promise<CompleteResult> => {
      try {
        const body = await sendJson<{ orderId: string }>('/api/checkout/complete', 'POST', { orderId });
        await mutate(KEY_CART, null, { revalidate: false });
        await mutate(KEY_ORDERS);
        return { ok: true, orderId: body.orderId };
      } catch (e) {
        return { ok: false, error: errorCode(e) };
      }
    },
    [mutate],
  );

  return useMemo(() => ({ start, complete }), [start, complete]);
}
