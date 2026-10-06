'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_CART, keySlots } from '@/lib/cache-keys';
import { ApiError, fetchJson, sendJson } from '@/lib/fetcher';
import type { SlotDaysBody } from '@/lib/slots/types';
import type { Address, Cart } from '@/lib/types';

export type AddressInput = Required<Pick<Address, 'firstName' | 'lastName' | 'streetName' | 'postalCode' | 'city' | 'country'>> &
  Pick<Address, 'additionalStreetInfo' | 'phone'>;

/** Mutations never throw on API answers; the caller reads `error` (an API error code, or `NETWORK`). */
export type DeliveryResult =
  | { ok: true; slotCleared: boolean }
  | { ok: false; error: string; fields?: string[]; slotCleared?: boolean; slots?: SlotDaysBody };

type CartBody = { cart: Cart; slotCleared?: boolean };
type ErrorBody = { error?: string; fields?: string[]; slotCleared?: boolean; cart?: Cart; days?: SlotDaysBody['days']; nextAvailableDate?: string };

/** Bookable slots for the cart's address; `enabled` false (no deliverable address) does not fetch. */
export function useSlots(address: { country: string; postalCode: string } | null) {
  const swr = useSWR<SlotDaysBody>(address ? keySlots(address.country, address.postalCode) : null, (): Promise<SlotDaysBody> => fetchJson('/api/slots'), {
    revalidateOnFocus: false,
  });
  return swr;
}

/** Address and slot mutations for the cart's delivery step. They write the returned cart into the cart cache. */
export function useDeliveryMutations() {
  const { mutate } = useSWRConfig();

  const run = useCallback(
    async (request: Promise<CartBody>): Promise<DeliveryResult> => {
      try {
        const body = await request;
        await mutate(KEY_CART, body.cart, { revalidate: false });
        return { ok: true, slotCleared: body.slotCleared ?? false };
      } catch (e) {
        if (!(e instanceof ApiError)) return { ok: false, error: 'NETWORK' };
        const data = (typeof e.data === 'object' && e.data !== null ? e.data : {}) as ErrorBody;
        if (data.cart) await mutate(KEY_CART, data.cart, { revalidate: false });
        return {
          ok: false,
          error: data.error ?? 'ERROR',
          ...(data.fields ? { fields: data.fields } : {}),
          ...(data.slotCleared !== undefined ? { slotCleared: data.slotCleared } : {}),
          ...(data.days ? { slots: { days: data.days, ...(data.nextAvailableDate ? { nextAvailableDate: data.nextAvailableDate } : {}) } } : {}),
        };
      }
    },
    [mutate],
  );

  const saveAddress = useCallback((address: AddressInput) => run(sendJson<CartBody>('/api/cart/address', 'PUT', address)), [run]);
  const pickSlot = useCallback((slotId: string) => run(sendJson<CartBody>('/api/cart/slot', 'PUT', { slotId })), [run]);
  const clearSlot = useCallback(() => run(sendJson<CartBody>('/api/cart/slot', 'DELETE')), [run]);

  return useMemo(() => ({ saveAddress, pickSlot, clearSlot }), [saveAddress, pickSlot, clearSlot]);
}
