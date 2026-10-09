'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import useSWR, { useSWRConfig, type SWRResponse } from 'swr';
import { useAccount } from '@/hooks/use-account';
import { useToast } from '@/components/ui/Toast';
import { API_CART, API_CART_RX_LINES, API_CART_SUMMARY, apiCartLine } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS } from '@/lib/cache-keys';
import { fetchJson, isUnauthorized } from '@/lib/http';
import type { Cart, CartSummary, RxLineView } from '@/lib/types';

/** A 401 means "signed out": there is no cart to show, which is not a failure. */
async function orNullWhenSignedOut<T>(load: () => Promise<T | null>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export const fetchCartSummary = (): Promise<CartSummary | null> => orNullWhenSignedOut(() => fetchJson<CartSummary | null>(API_CART_SUMMARY));
export const fetchCart = (): Promise<Cart | null> => orNullWhenSignedOut(() => fetchJson<Cart | null>(API_CART));

/**
 * Cart summary for the header count (cheap read, no re-validation). The root layout seeds it from the session
 * (`cartId`); sign-in revalidates it. `null` means no cart.
 */
export function useCart(): SWRResponse<CartSummary | null> {
  // Only a signed-in visitor has a cart: no request for a signed-out one (the account key is seeded by the layout).
  const { data: account } = useAccount();
  const signedIn = Boolean(account);
  const swr = useSWR<CartSummary | null>(signedIn ? KEY_CART : null, fetchCartSummary, { revalidateIfStale: false, revalidateOnFocus: false, shouldRetryOnError: false });
  const { mutate } = swr;
  // Signing in while mounted: the sign-out left `null` in the cache, so read the cart once (not on first mount: the layout seeded it).
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (signedIn && !wasSignedIn.current) void mutate();
    wasSignedIn.current = signedIn;
  }, [signedIn, mutate]);
  // Signed out: no cart, whatever the cache still holds.
  return signedIn ? swr : { ...swr, data: null };
}

/**
 * The full cart for the cart page: every line re-validated and the platform's totals. Revalidates on focus so a
 * prescription that expired meanwhile shows up. Never use it for the header (it re-validates and recalculates).
 */
export function useCartDetails(): SWRResponse<Cart | null> {
  return useSWR<Cart | null>(KEY_CART_DETAILS, fetchCart, { revalidateOnFocus: true, shouldRetryOnError: false });
}

/** Result of adding lines: the rows the server refused (the rest were added). */
export interface AddRxLinesResult {
  cart: Cart;
  refused: RxLineView[];
}

/** Adds the selected lines of a prescription to the cart. Throws `HttpError` when the server refuses. */
export type AddRxLines = (rxNumber: string, lineRefs: string[]) => Promise<void>;

/**
 * Cart mutations. Every one revalidates from the server (no optimistic updates): the totals shown are always the
 * platform's answer for the cart's current state. The RX number travels in the request body, never in a URL.
 */
export function useCartMutations() {
  const { mutate } = useSWRConfig();
  const refresh = useCallback(() => Promise.all([mutate(KEY_CART), mutate(KEY_CART_DETAILS)]), [mutate]);

  const addRxLines = useCallback(
    async (rxNumber: string, lineRefs: string[]): Promise<AddRxLinesResult> => {
      const result = await fetchJson<AddRxLinesResult>(API_CART_RX_LINES, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rxNumber, lineRefs }),
      });
      await refresh();
      return result;
    },
    [refresh],
  );

  const removeLine = useCallback(
    async (lineId: string): Promise<void> => {
      await fetchJson(apiCartLine(lineId), { method: 'DELETE' });
      await refresh();
    },
    [refresh],
  );

  return { addRxLines, removeLine, refresh };
}

/** The prescriptions page's injected add function. Same signature as before the cart existed. */
export function useAddRxLines(): AddRxLines {
  const { addRxLines } = useCartMutations();
  return useCallback(
    async (rxNumber, lineRefs) => {
      await addRxLines(rxNumber, lineRefs);
    },
    [addRxLines],
  );
}

/** `addRxLines` plus the "Added to cart / View cart" toast (needs `ToastProvider`). Throws like `addRxLines`. */
export function useAddWithToast(): AddRxLines {
  const t = useTranslations('cart');
  const toast = useToast();
  const add = useAddRxLines();
  return useCallback(
    async (rxNumber, lineRefs) => {
      await add(rxNumber, lineRefs);
      toast.show({ message: t('added'), action: { label: t('viewCart'), href: '/cart' } });
    },
    [add, toast, t],
  );
}
