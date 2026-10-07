'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ApiError, type ApiErrorCode } from '@/lib/api-error';
import { KEY_CART } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/fetcher';
import type { BlockedAdd, Cart, DiscountPrompt } from '@/lib/types';

/** What the cart routes answer: always the full mapped cart (null when there is none). */
export type CartPayload = { cart: Cart | null };

/** A refused cart request. `bundleCode` is the stable code of the bundle API (`OFFER_BLOCKED`, `HAS_DEPENDENTS`, ...). */
export class CartError extends ApiError {
  constructor(
    public bundleCode: string,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
    public httpStatus = 0,
  ) {
    super(code, message, details);
    this.name = 'CartError';
  }

  /** The refusal of an add (kind, reasons, replace target), when this is OFFER_BLOCKED. */
  get blocked(): BlockedAdd | undefined {
    return this.bundleCode === 'OFFER_BLOCKED' ? (this.details as unknown as BlockedAdd) : undefined;
  }
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  return status >= 500 ? 'UPSTREAM_ERROR' : 'INTERNAL';
}

export interface AddLineArgs {
  offerKey: string;
  sku: string;
  quantity?: number;
  parentLineId?: string;
  replaceLineId?: string;
}

export interface CartMutations {
  addLine: (args: AddLineArgs) => Promise<Cart | null>;
  setQuantity: (lineId: string, quantity: number) => Promise<Cart | null>;
  removeLine: (lineId: string, options?: { cascade?: boolean }) => Promise<Cart | null>;
  applyCode: (code: string) => Promise<Cart | null>;
  removeCode: (code: string) => Promise<Cart | null>;
  setPostalCode: (postalCode: string) => Promise<Cart | null>;
}

const readCart = (): Promise<Cart | null> => fetchJson<CartPayload>(KEY_CART).then((payload) => payload.cart);

/** The bundle. `null` = no cart yet (a visitor who only browses has none). Revalidates when the tab regains focus. */
export function useCart() {
  const { data, error, isLoading } = useSWR<Cart | null>(KEY_CART, readCart, { revalidateOnFocus: true });
  const cart = data ?? null;
  return { cart, itemCount: cart?.itemCount ?? 0, isLoading, error };
}

/**
 * Every mutation writes the cart of the RESPONSE into the SWR cache (also the `cart` that comes with a refusal) and never refetches or
 * computes anything: totals are the server's. A refusal then throws a CartError so the caller can show the reason.
 */
export function useCartMutations(): CartMutations {
  const { mutate } = useSWRConfig();

  const send = useCallback(
    async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<Cart | null> => {
      let response: Response;
      try {
        response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
      } catch {
        throw new CartError('NETWORK', 'UPSTREAM_ERROR', 'The service is temporarily unavailable');
      }
      let payload: { cart?: Cart | null; error?: { code?: unknown; message?: unknown; details?: unknown } } | undefined;
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        payload = undefined;
      }
      if (payload && payload.cart !== undefined) await mutate(KEY_CART, payload.cart, { revalidate: false });
      if (!response.ok || !payload || payload.cart === undefined) {
        const error = payload?.error;
        const bundleCode = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
        const details = typeof error?.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : undefined;
        throw new CartError(bundleCode, codeForStatus(response.status), typeof error?.message === 'string' ? error.message : 'The service is temporarily unavailable', details, response.status);
      }
      return payload.cart;
    },
    [mutate],
  );

  return useMemo<CartMutations>(
    () => ({
      addLine: (args) => send('/api/cart/line-items', 'POST', args),
      setQuantity: (lineId, quantity) => send(`/api/cart/line-items/${encodeURIComponent(lineId)}`, 'PATCH', { quantity }),
      removeLine: (lineId, options) => send(`/api/cart/line-items/${encodeURIComponent(lineId)}${options?.cascade ? '?cascade=true' : ''}`, 'DELETE'),
      applyCode: (code) => send('/api/cart/discount-code', 'POST', { code }),
      removeCode: (code) => send(`/api/cart/discount-code?code=${encodeURIComponent(code)}`, 'DELETE'),
      setPostalCode: (postalCode) => send('/api/cart/address', 'POST', { postalCode }),
    }),
    [send],
  );
}

/** Prompts are re-priced by the server for every cart version (never cached). */
export function useDiscountPrompts(cart: Cart | null) {
  const { data, isLoading } = useSWR<DiscountPrompt[]>(cart && cart.lines.length > 0 ? ['/api/cart/prompts', cart.version] : null, () =>
    fetchJson<{ prompts: DiscountPrompt[] }>('/api/cart/prompts').then((payload) => payload.prompts),
  );
  return { prompts: data ?? [], isLoading };
}
