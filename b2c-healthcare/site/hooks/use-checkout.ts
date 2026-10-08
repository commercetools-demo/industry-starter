'use client';
import { useCallback } from 'react';
import useSWR, { useSWRConfig, type SWRResponse } from 'swr';
import type { AddressProblems } from '@/lib/address';
import { API_CHECKOUT, API_CHECKOUT_ADDRESS, API_CHECKOUT_DEMO_AUTHORIZE, API_CHECKOUT_PLACE, API_CHECKOUT_SHIPPING_METHOD } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS, KEY_CHECKOUT } from '@/lib/cache-keys';
import { fetchJson, isUnauthorized } from '@/lib/http';
import type { AddressInput, CheckoutState, Money, PlaceOrderFailure } from '@/lib/types';

/** `GET /api/checkout`; `null` when signed out or when there is no cart. */
export async function fetchCheckout(): Promise<CheckoutState | null> {
  try {
    return await fetchJson<CheckoutState | null>(API_CHECKOUT);
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export type AddressSaveResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; fields: AddressProblems }
  /** The address is saved on the cart but no delivery option serves it (the state in the cache says so). */
  | { ok: false; reason: 'undeliverable' }
  | { ok: false; reason: 'failed' };

export type MethodChangeResult = { ok: true } | { ok: false; reason: 'unavailable' | 'failed' };

interface Answer {
  code?: string;
  fields?: AddressProblems;
  state?: CheckoutState;
}

async function send(path: string, body: unknown): Promise<{ status: number; data: (Answer & Partial<CheckoutState>) | null }> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { status: 0, data: null };
  }
  const data = (await response.json().catch(() => null)) as (Answer & Partial<CheckoutState>) | null;
  return { status: response.status, data };
}

/**
 * The checkout page's server state. Every change goes to the server and the answer (the cart as re-read after the
 * change, plus the delivery options) replaces what is cached: the page never edits a total or an option itself.
 * A 422 carries the current state too, so the summary stays right when a change is refused.
 */
export function useCheckout(): SWRResponse<CheckoutState | null> & {
  saveAddress: (input: AddressInput) => Promise<AddressSaveResult>;
  chooseMethod: (key: string) => Promise<MethodChangeResult>;
} {
  const swr = useSWR<CheckoutState | null>(KEY_CHECKOUT, fetchCheckout, { revalidateOnFocus: false, shouldRetryOnError: false });
  const { mutate } = swr;

  const saveAddress = useCallback(
    async (input: AddressInput): Promise<AddressSaveResult> => {
      const { status, data } = await send(API_CHECKOUT_ADDRESS, input);
      if (status === 200 && data?.cart) {
        await mutate(data as CheckoutState, { revalidate: false });
        return { ok: true };
      }
      if (status === 400 && data?.fields) return { ok: false, reason: 'invalid', fields: data.fields };
      if (status === 422 && data?.state) {
        await mutate(data.state, { revalidate: false });
        return { ok: false, reason: 'undeliverable' };
      }
      return { ok: false, reason: 'failed' };
    },
    [mutate],
  );

  const chooseMethod = useCallback(
    async (key: string): Promise<MethodChangeResult> => {
      const { status, data } = await send(API_CHECKOUT_SHIPPING_METHOD, { key });
      if (status === 200 && data?.cart) {
        await mutate(data as CheckoutState, { revalidate: false });
        return { ok: true };
      }
      if (status === 422 && data?.state) {
        await mutate(data.state, { revalidate: false });
        return { ok: false, reason: 'unavailable' };
      }
      return { ok: false, reason: 'failed' };
    },
    [mutate],
  );

  return Object.assign(swr, { saveAddress, chooseMethod });
}

export type PlaceResult =
  | { ok: true; orderId: string }
  /** `UNAVAILABLE`: payment is not configured (503); `FAILED`: the server could not be reached or answered oddly. */
  | { ok: false; code: PlaceOrderFailure | 'UNAVAILABLE' | 'FAILED' };

export type DemoAuthorizeResult = 'authorized' | 'declined' | 'failed';

/**
 * The two server calls of the payment step. `placeOrder` sends the amount the buyer saw and the cart version the
 * page showed (the idempotency key is built from the session's cart id and that version on the server). On success
 * the cart caches are cleared: the cart is now an order.
 */
export function usePaymentActions() {
  const { mutate } = useSWRConfig();

  const placeOrder = useCallback(
    async (cart: { version: number; total: Money }): Promise<PlaceResult> => {
      let response: Response;
      try {
        response = await fetch(API_CHECKOUT_PLACE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedTotal: { centAmount: cart.total.centAmount, currencyCode: cart.total.currencyCode }, cartVersion: cart.version }),
        });
      } catch {
        return { ok: false, code: 'FAILED' };
      }
      const data = (await response.json().catch(() => null)) as { orderId?: string; code?: PlaceOrderFailure } | null;
      if (response.ok && typeof data?.orderId === 'string') {
        await Promise.all([KEY_CART, KEY_CART_DETAILS, KEY_CHECKOUT].map((key) => mutate(key, null, { revalidate: false })));
        return { ok: true, orderId: data.orderId };
      }
      if (response.status === 503) return { ok: false, code: 'UNAVAILABLE' };
      return { ok: false, code: data?.code ?? 'FAILED' };
    },
    [mutate],
  );

  /** Demo provider only (the endpoint is a 404 elsewhere). */
  const demoAuthorize = useCallback(async (decline: boolean): Promise<DemoAuthorizeResult> => {
    try {
      const response = await fetch(API_CHECKOUT_DEMO_AUTHORIZE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decline }) });
      const data = (await response.json().catch(() => null)) as { status?: string } | null;
      return response.ok && (data?.status === 'authorized' || data?.status === 'declined') ? data.status : 'failed';
    } catch {
      return 'failed';
    }
  }, []);

  return { placeOrder, demoAuthorize };
}
