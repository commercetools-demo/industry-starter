'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { ResolveResult } from '@/lib/addresses/resolver';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import type { AddressField, AddressFieldError, AddressInput, SavedAddress } from '@/lib/types';
import { accountRequest } from './accountRequest';

export { KEY_ADDRESSES };

const URL = '/api/account/addresses';
type AddressesPayload = { addresses: SavedAddress[] };

/** The signed-in customer's address book. No request is made when `enabled` is false (anonymous visitors). U imports this. */
export function useAddresses({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, error, isLoading } = useSWR<AddressesPayload>(enabled ? KEY_ADDRESSES : null, () => accountRequest<AddressesPayload>(URL, 'GET'));
  const addresses = useMemo(() => data?.addresses ?? [], [data]);
  const defaultService = useMemo(() => addresses.find((address) => address.isDefaultService) ?? null, [addresses]);
  const defaultBilling = useMemo(() => addresses.find((address) => address.isDefaultBilling) ?? null, [addresses]);
  return { addresses, defaultService, defaultBilling, isLoading, error };
}

export interface SaveOptions {
  makeDefaultService?: boolean;
  makeDefaultBilling?: boolean;
  /** The buyer saw the "could not verify" panel and chose to keep or use the suggestion. */
  confirmed?: boolean;
}
export interface ValidateResult {
  fields: Partial<Record<AddressField, AddressFieldError>>;
  resolve?: ResolveResult;
}

export interface AddressMutations {
  add: (input: AddressInput, options?: SaveOptions) => Promise<SavedAddress[]>;
  update: (id: string, input: AddressInput, options?: Pick<SaveOptions, 'confirmed'>) => Promise<SavedAddress[]>;
  remove: (id: string) => Promise<SavedAddress[]>;
  makeDefault: (id: string, kind: 'service' | 'billing') => Promise<SavedAddress[]>;
  validate: (input: AddressInput) => Promise<ValidateResult>;
}

/** Every write answers with the whole list; it goes into the cache as it is (never merged on the client). A refusal throws `AccountApiError`. */
export function useAddressMutations(): AddressMutations {
  const { mutate } = useSWRConfig();
  return useMemo<AddressMutations>(() => {
    const store = async (payload: AddressesPayload): Promise<SavedAddress[]> => {
      await mutate(KEY_ADDRESSES, payload, { revalidate: false });
      return payload.addresses;
    };
    return {
      add: async (input, options = {}) => store(await accountRequest<AddressesPayload>(URL, 'POST', { address: input, ...options })),
      update: async (id, input, options = {}) => store(await accountRequest<AddressesPayload>(`${URL}/${encodeURIComponent(id)}`, 'PATCH', { address: input, ...options })),
      remove: async (id) => store(await accountRequest<AddressesPayload>(`${URL}/${encodeURIComponent(id)}`, 'DELETE')),
      makeDefault: async (id, kind) => store(await accountRequest<AddressesPayload>(`${URL}/${encodeURIComponent(id)}/default`, 'POST', { kind })),
      validate: (input) => accountRequest<ValidateResult>(`${URL}/validate`, 'POST', { address: input }),
    };
  }, [mutate]);
}
