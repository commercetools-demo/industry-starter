'use client';
import { useCallback } from 'react';
import useSWR, { useSWRConfig, type SWRResponse } from 'swr';
import { API_CART_RX_LINES } from '@/lib/api-paths';
import { KEY_CART } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/http';
import type { CartSummary } from '@/lib/types';

/**
 * Cart state. Placeholder: reads the SWR cache only (seeded by the root layout fallback) and calls
 * no endpoint yet; the cart workstream passes a fetcher built on `API_CART` from lib/api-paths.
 * `null` means no cart.
 */
export function useCart(): SWRResponse<CartSummary | null> {
  return useSWR<CartSummary | null>(KEY_CART, null);
}

/** Adds the selected lines of a prescription to the cart. Throws `HttpError` when the server refuses. */
export type AddRxLines = (rxNumber: string, lineRefs: string[]) => Promise<void>;

/**
 * Placeholder for the cart workstream (O), which owns `POST /api/cart/rx-lines` and should fold this into `useCart`
 * as `addRxLines`. The prescriptions page receives it as an injected function, so O only has to replace this body.
 * The RX number travels in the request body, never in a URL.
 */
export function useAddRxLines(): AddRxLines {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (rxNumber, lineRefs) => {
      await fetchJson(API_CART_RX_LINES, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rxNumber, lineRefs }) });
      await mutate(KEY_CART);
    },
    [mutate],
  );
}
