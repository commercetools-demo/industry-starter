'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { KEY_ACCOUNT, keyAddresses } from '@/lib/cache-keys';
import type { AddressInput, AppAddress, AppCustomer } from '@/lib/types';

export interface AddressWrite { address: AddressInput; makeDefault?: boolean; confirmed?: boolean }

const send = <T,>(method: string, url: string, body?: unknown): Promise<T> =>
  fetchJson<T>(url, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

/**
 * The customer's address book. Writes answer the new list, which becomes the cache value (their own key only); the account
 * entry (`useAccount().customer.addresses`, read by checkout) is refreshed too. Failures throw `ApiError` with
 * `extra.fields` (validation) or `extra.unresolved` and `extra.suggestion` (address_needs_confirmation).
 */
export function useAddresses() {
  const { customer, mutate: mutateAccount } = useAccount();
  const customerId = customer?.id ?? null;
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useAccountSwr<{ addresses: AppAddress[] }>(
    customerId ? keyAddresses(customerId) : null,
    '/api/account/addresses',
  );

  const adopt = useCallback(
    async (addresses: AppAddress[]) => {
      if (!customerId) return;
      await mutate(keyAddresses(customerId), { addresses }, { revalidate: false });
      const defaultShipping = addresses.find((a) => a.isDefaultShipping)?.id ?? null;
      await mutateAccount(
        (current: { customer: AppCustomer | null } | undefined) =>
          current?.customer ? { customer: { ...current.customer, addresses, defaultShippingAddressId: defaultShipping } } : current,
        { revalidate: false },
      );
      void mutate(KEY_ACCOUNT);
    },
    [customerId, mutate, mutateAccount],
  );

  const add = useCallback(
    async (input: AddressWrite) => {
      const res = await send<{ addresses: AppAddress[] }>('POST', '/api/account/addresses', input);
      await adopt(res.addresses);
    },
    [adopt],
  );
  const change = useCallback(
    async (id: string, input: AddressWrite) => {
      const res = await send<{ addresses: AppAddress[] }>('PATCH', `/api/account/addresses/${encodeURIComponent(id)}`, input);
      await adopt(res.addresses);
    },
    [adopt],
  );
  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      const res = await send<{ addresses: AppAddress[]; promotedId: string | null }>('DELETE', `/api/account/addresses/${encodeURIComponent(id)}`);
      await adopt(res.addresses);
      return res.promotedId;
    },
    [adopt],
  );

  return { addresses: data?.addresses ?? null, isLoading, isError: Boolean(error), reload, add, change, remove, customerId };
}
