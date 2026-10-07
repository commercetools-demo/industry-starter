'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { AddressValues } from '@/lib/address-validation';
import { KEY_ADDRESSES, KEY_PROFILE } from '@/lib/cache-keys';
import { ApiError, fetchJson, sendJson } from '@/lib/fetcher';
import type { SavedAddress } from '@/lib/types';

type AddressesBody = { addresses: SavedAddress[] };
/** A missing session (401) or address (404) will not change by retrying. */
const retryable = (error: unknown): boolean => !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/** The customer's address book. `enabled: false` (anonymous shopper) does not fetch. Safe default: no addresses. */
export function useAddresses({ enabled = true }: { enabled?: boolean } = {}) {
  const swr = useSWR<SavedAddress[]>(enabled ? KEY_ADDRESSES : null, async () => (await fetchJson<AddressesBody>('/api/account/addresses')).addresses, {
    shouldRetryOnError: retryable,
  });
  const addresses = swr.data ?? [];
  return { ...swr, addresses, defaultAddress: addresses.find((a) => a.isDefaultShipping) ?? null };
}

/**
 * Add / update / remove / make default. Each call writes the list from the answer into the cache and refreshes the
 * dashboard profile (it shows the default address). Failures throw `ApiError` (400 `INVALID_ADDRESS` carries
 * `data.fields`, 404 `ADDRESS_NOT_FOUND`) and leave the cache untouched.
 */
export function useAddressMutations() {
  const { mutate } = useSWRConfig();

  const apply = useCallback(
    async (request: Promise<AddressesBody>): Promise<SavedAddress[]> => {
      const { addresses } = await request;
      await mutate(KEY_ADDRESSES, addresses, { revalidate: false });
      void mutate(KEY_PROFILE);
      return addresses;
    },
    [mutate],
  );

  const add = useCallback((address: AddressValues) => apply(sendJson<AddressesBody>('/api/account/addresses', 'POST', address)), [apply]);
  const update = useCallback(
    (id: string, address: AddressValues) => apply(sendJson<AddressesBody>(`/api/account/addresses/${encodeURIComponent(id)}`, 'PATCH', address)),
    [apply],
  );
  const remove = useCallback((id: string) => apply(sendJson<AddressesBody>(`/api/account/addresses/${encodeURIComponent(id)}`, 'DELETE')), [apply]);
  const makeDefault = useCallback((id: string) => apply(sendJson<AddressesBody>(`/api/account/addresses/${encodeURIComponent(id)}/default`, 'POST')), [apply]);

  return useMemo(() => ({ add, update, remove, makeDefault }), [add, update, remove, makeDefault]);
}
