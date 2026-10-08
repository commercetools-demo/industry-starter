'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_CART, KEY_CHECKOUT } from '@/lib/cache-keys';
import { buildReview } from '@/lib/checkout/review';
import { toDateOnly } from '@/lib/pricing/dates';
import type { CheckoutAddress, CheckoutReview, CheckoutSessionInfo, CheckoutState, ShippingOption } from '@/lib/types';

/** A refused checkout request: the stable code of the checkout API, the HTTP status, the details and (when the cart exists) its state. */
export class CheckoutError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
    readonly state?: CheckoutState,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export interface DeliveryPayload {
  options: ShippingOption[];
  needsDelivery: boolean;
  state: CheckoutState;
}

export interface DetailsInput {
  email?: string;
  phone?: string;
  serviceAddress?: CheckoutAddress;
  billingAddress?: CheckoutAddress;
}

type ErrorPayload = { error?: { code?: unknown; message?: unknown; details?: unknown }; state?: CheckoutState };

async function send<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  } catch {
    throw new CheckoutError('NETWORK', 'The service is temporarily unavailable', 0);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const failed = (payload ?? {}) as ErrorPayload;
    const error = failed.error;
    const details = typeof error?.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : undefined;
    throw new CheckoutError(typeof error?.code === 'string' ? error.code : 'UNKNOWN', typeof error?.message === 'string' ? error.message : 'The service is temporarily unavailable', response.status, details, failed.state);
  }
  return payload as T;
}

/**
 * The checkout state and its writes. Every write answers with the cart state read back from the server; it goes into the SWR cache as it
 * is (also the state that comes with a refusal) and the shared cart cache is updated with the cart of the answer. Nothing is computed here.
 */
export function useCheckout(initial: CheckoutState) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<CheckoutState>(KEY_CHECKOUT, () => send<{ review: CheckoutReview }>(KEY_CHECKOUT, 'GET').then((payload) => payload.review.state), {
    fallbackData: initial,
    revalidateOnMount: false,
    revalidateOnFocus: false,
  });
  const state = data ?? initial;
  const review = useMemo(() => buildReview(state, toDateOnly(new Date())), [state]);

  const apply = useCallback(
    async (next: CheckoutState): Promise<CheckoutState> => {
      await mutate(KEY_CHECKOUT, next, { revalidate: false });
      await mutate(KEY_CART, next.cart, { revalidate: false });
      return next;
    },
    [mutate],
  );

  const write = useCallback(
    async <T extends { state: CheckoutState }>(run: () => Promise<T>): Promise<T> => {
      try {
        const result = await run();
        await apply(result.state);
        return result;
      } catch (error) {
        if (error instanceof CheckoutError && error.state) await apply(error.state);
        throw error;
      }
    },
    [apply],
  );

  return useMemo(
    () => ({
      state,
      review,
      saveDetails: async (input: DetailsInput): Promise<CheckoutState> => (await write(() => send<{ state: CheckoutState }>('/api/checkout/details', 'POST', input))).state,
      loadDelivery: async (): Promise<DeliveryPayload> => write(() => send<DeliveryPayload>('/api/checkout/delivery', 'GET')),
      selectDelivery: async (shippingMethodId: string): Promise<CheckoutState> => (await write(() => send<{ state: CheckoutState }>('/api/checkout/delivery', 'POST', { shippingMethodId }))).state,
      /** Re-reads the cart (also the focus check of the payment step). */
      refresh: async (): Promise<CheckoutState> => apply((await send<{ review: CheckoutReview }>('/api/checkout/review', 'GET')).review.state),
      startPayment: async (expectedTotalCents: number): Promise<CheckoutSessionInfo> => {
        try {
          return (await send<{ session: CheckoutSessionInfo }>('/api/checkout/session', 'POST', { expectedTotalCents })).session;
        } catch (error) {
          if (error instanceof CheckoutError && error.state) await apply(error.state);
          throw error;
        }
      },
      completeOrder: async (orderId: string): Promise<string> => {
        const { orderNumber } = await send<{ orderNumber: string }>('/api/checkout/complete', 'POST', { orderId });
        await mutate(KEY_CART, null, { revalidate: false });
        return orderNumber;
      },
      demoPay: async (expectedTotalCents: number): Promise<string> => {
        try {
          const { orderNumber } = await send<{ orderNumber: string }>('/api/checkout/demo-payment', 'POST', { expectedTotalCents });
          await mutate(KEY_CART, null, { revalidate: false });
          return orderNumber;
        } catch (error) {
          if (error instanceof CheckoutError && error.state) await apply(error.state);
          throw error;
        }
      },
    }),
    [state, review, write, apply, mutate],
  );
}
