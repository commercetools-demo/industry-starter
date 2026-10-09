'use client';
import { useCallback } from 'react';
import useSWR, { useSWRConfig, type SWRResponse } from 'swr';
import type { AddressProblems } from '@/lib/address';
import { API_CHECKOUT, API_CHECKOUT_ADDRESS, API_CHECKOUT_COMPLETE, API_CHECKOUT_DEMO_AUTHORIZE, API_CHECKOUT_PREPARE, API_CHECKOUT_SHIPPING_METHOD, API_CHECKOUT_TENDER } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS, KEY_CHECKOUT } from '@/lib/cache-keys';
import { fetchJson, isUnauthorized } from '@/lib/http';
import type { AddressInput, CheckoutState, Money, PlaceOrderFailure, PrepareResult } from '@/lib/types';

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

export type RestrictedChangeResult = { ok: true } | { ok: false; reason: 'none-eligible' | 'failed' };

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
  /** Use (or drop) the restricted instrument; the answer replaces the cached state. */
  chooseRestricted: (on: boolean) => Promise<RestrictedChangeResult>;
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

  const chooseRestricted = useCallback(
    async (on: boolean): Promise<RestrictedChangeResult> => {
      const { status, data } = await send(API_CHECKOUT_TENDER, { restricted: on });
      if (status === 200 && data?.cart) {
        await mutate(data as CheckoutState, { revalidate: false });
        return { ok: true };
      }
      if (status === 422 && data?.state) {
        await mutate(data.state, { revalidate: false });
        return { ok: false, reason: 'none-eligible' };
      }
      return { ok: false, reason: 'failed' };
    },
    [mutate],
  );

  return Object.assign(swr, { saveAddress, chooseMethod, chooseRestricted });
}

export type PrepareClientResult =
  | { ok: true; result: PrepareResult }
  /** `UNAVAILABLE`: payment is not configured (503); `FAILED`: the server could not be reached or answered oddly. */
  | { ok: false; code: PlaceOrderFailure | 'UNAVAILABLE' | 'FAILED' };

export type CompleteClientResult = { ok: true; orderId: string } | { ok: false; code: string };

export type DemoAuthorizeResult = { status: 'authorized'; orderId: string } | { status: 'declined' | 'failed' };

/**
 * The server calls of the payment step. `prepare` is the gate before Checkout: it sends the amount the buyer saw
 * (compared with the cart, never charged) and answers what to mount. `complete` is the completion callback: Checkout
 * created the order, the server finalizes it. On success the cart caches are cleared: the cart is now an order.
 */
export function usePaymentActions() {
  const { mutate } = useSWRConfig();
  const clearCaches = useCallback(() => Promise.all([KEY_CART, KEY_CART_DETAILS, KEY_CHECKOUT].map((key) => mutate(key, null, { revalidate: false }))), [mutate]);

  const prepare = useCallback(
    async (cart: { total: Money }): Promise<PrepareClientResult> => {
      let response: Response;
      try {
        response = await fetch(API_CHECKOUT_PREPARE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedTotal: { centAmount: cart.total.centAmount, currencyCode: cart.total.currencyCode } }),
        });
      } catch {
        return { ok: false, code: 'FAILED' };
      }
      const data = (await response.json().catch(() => null)) as (Partial<PrepareResult> & { code?: PlaceOrderFailure }) | null;
      if (response.ok && (data?.kind === 'checkout' || data?.kind === 'demo' || data?.kind === 'order')) {
        if (data.kind === 'order') await clearCaches();
        return { ok: true, result: data as PrepareResult };
      }
      if (response.status === 503 && !data?.code) return { ok: false, code: 'UNAVAILABLE' };
      return { ok: false, code: data?.code ?? 'FAILED' };
    },
    [clearCaches],
  );

  const complete = useCallback(
    async (orderId: string): Promise<CompleteClientResult> => {
      let response: Response;
      try {
        response = await fetch(API_CHECKOUT_COMPLETE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) });
      } catch {
        return { ok: false, code: 'FAILED' };
      }
      const data = (await response.json().catch(() => null)) as { orderId?: string; code?: string } | null;
      if (response.ok && typeof data?.orderId === 'string') {
        await clearCaches();
        return { ok: true, orderId: data.orderId };
      }
      return { ok: false, code: data?.code ?? 'FAILED' };
    },
    [clearCaches],
  );

  /** Demo provider only (the endpoint is a 404 elsewhere): the stand-in for Checkout authorizing and creating the order. */
  const demoAuthorize = useCallback(async (decline: boolean): Promise<DemoAuthorizeResult> => {
    try {
      const response = await fetch(API_CHECKOUT_DEMO_AUTHORIZE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decline }) });
      const data = (await response.json().catch(() => null)) as { status?: string; orderId?: string } | null;
      if (response.ok && data?.status === 'authorized' && typeof data.orderId === 'string') return { status: 'authorized', orderId: data.orderId };
      return { status: response.ok && data?.status === 'declined' ? 'declined' : 'failed' };
    } catch {
      return { status: 'failed' };
    }
  }, []);

  return { prepare, complete, demoAuthorize };
}
