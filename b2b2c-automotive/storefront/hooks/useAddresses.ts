// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR from 'swr';
import { accountFetcher, accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT_ADDRESSES } from '@/lib/cache-keys';
import type { AccountAddress, AddressInput } from '@/lib/types';

export interface AddressBookState {
  addresses: AccountAddress[];
  defaultShippingAddressId: string | null;
  /** The store's countries (the form's country select). Empty means the store lists none. */
  countries: string[];
}

export interface UseAddresses {
  book: AddressBookState | undefined;
  isLoading: boolean;
  error: unknown;
  reload: () => Promise<unknown>;
  /** Each write throws an `AccountApiError` with the machine code (`country-not-served`, `postal-invalid`, `address-limit`) and updates the list. */
  add: (input: AddressInput) => Promise<void>;
  change: (id: string, input: AddressInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  makeDefault: (id: string) => Promise<void>;
}

export function useAddresses(): UseAddresses {
  const { data, error, isLoading, mutate } = useSWR<AddressBookState>(KEY_ACCOUNT_ADDRESSES, accountFetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  const apply = async (next: Promise<AddressBookState>) =>
    void (await mutate(next.then((book) => ({ ...book, countries: book.countries ?? data?.countries ?? [] })), { revalidate: false }));
  return {
    book: data,
    isLoading,
    error,
    reload: () => mutate(),
    add: (input) => apply(accountRequest('POST', KEY_ACCOUNT_ADDRESSES, input)),
    change: (id, input) => apply(accountRequest('PUT', `${KEY_ACCOUNT_ADDRESSES}/${encodeURIComponent(id)}`, input)),
    remove: (id) => apply(accountRequest('DELETE', `${KEY_ACCOUNT_ADDRESSES}/${encodeURIComponent(id)}`)),
    makeDefault: (id) => apply(accountRequest('PATCH', `${KEY_ACCOUNT_ADDRESSES}/${encodeURIComponent(id)}`)),
  };
}
