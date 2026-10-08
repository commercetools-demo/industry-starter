'use client';
import { useCallback } from 'react';
import useSWR, { type SWRResponse } from 'swr';
import type { AddressProblems } from '@/lib/address';
import { API_CHECKOUT, API_CHECKOUT_ADDRESS, API_CHECKOUT_SHIPPING_METHOD } from '@/lib/api-paths';
import { KEY_CHECKOUT } from '@/lib/cache-keys';
import { fetchJson, isUnauthorized } from '@/lib/http';
import type { AddressInput, CheckoutState } from '@/lib/types';

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
