'use client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_ACCOUNT, KEY_ADDRESSES, KEY_CART, KEY_CART_DETAILS, KEY_CHECKOUT } from '@/lib/cache-keys';

type Mutate = (key: string, data: null, options: { revalidate: false }) => Promise<unknown>;

/**
 * Clears the patient-scoped client state without refetching, so the next patient on this browser sees none of it.
 * Writes `null`, not `undefined`: SWR falls back to the layout fallback for undefined data, which would resurrect the old cart.
 */
export async function clearPatientState(mutate: Mutate): Promise<void> {
  await Promise.all([KEY_ACCOUNT, KEY_CART, KEY_CART_DETAILS, KEY_ADDRESSES, KEY_CHECKOUT].map((key) => mutate(key, null, { revalidate: false })));
}

/** Call after the sign-out endpoint succeeded. */
export function useClearPatientState(): () => Promise<void> {
  const { mutate } = useSWRConfig();
  return useCallback(() => clearPatientState(mutate as Mutate), [mutate]);
}
