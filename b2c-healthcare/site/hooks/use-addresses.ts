'use client';
import { useCallback } from 'react';
import useSWR from 'swr';
import { API_ACCOUNT_ADDRESSES, apiAccountAddress, apiAccountAddressDefault } from '@/lib/api-paths';
import { defaultAddress, type AddressProblems, type AddressWarning } from '@/lib/address';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/http';
import type { Address, AddressInput } from '@/lib/types';

export interface SaveOptions {
  makeDefault?: boolean;
  /** The patient's answer to a state/ZIP warning: store the address as typed. */
  confirmed?: boolean;
}

export type AddressResult =
  | { ok: true }
  /** Format-valid, but the state and ZIP disagree: nothing was stored; ask the patient. */
  | { ok: false; reason: 'needs-confirmation'; warning: AddressWarning }
  | { ok: false; reason: 'invalid'; fields: AddressProblems }
  /** `status` 0: the server could not be reached. */
  | { ok: false; reason: 'failed'; status: number };

interface Answer {
  status?: 'saved' | 'needs-confirmation';
  addresses?: Address[];
  warning?: AddressWarning;
  fields?: AddressProblems;
}

const fetchAddresses = async (): Promise<Address[]> => (await fetchJson<{ addresses: Address[] }>(API_ACCOUNT_ADDRESSES)).addresses;

async function send(path: string, method: string, body?: unknown): Promise<{ result: AddressResult; addresses?: Address[] }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { result: { ok: false, reason: 'failed', status: 0 } };
  }
  const data = (await response.json().catch(() => null)) as Answer | null;
  if (response.ok && data?.status === 'needs-confirmation' && data.warning) {
    return { result: { ok: false, reason: 'needs-confirmation', warning: data.warning } };
  }
  if (response.ok && data?.addresses) return { result: { ok: true }, addresses: data.addresses };
  if (response.status === 400 && data?.fields) return { result: { ok: false, reason: 'invalid', fields: data.fields } };
  return { result: { ok: false, reason: 'failed', status: response.status } };
}

export interface UseAddresses {
  /** Saved addresses (default first); `undefined` while loading. */
  addresses: Address[] | undefined;
  /** The default shipping address, or null (checkout then asks the patient to choose); undefined while loading. */
  defaultAddress: Address | null | undefined;
  error: unknown;
  isLoading: boolean;
  add: (input: AddressInput, options?: SaveOptions) => Promise<AddressResult>;
  update: (id: string, input: AddressInput, options?: SaveOptions) => Promise<AddressResult>;
  remove: (id: string) => Promise<AddressResult>;
  makeDefault: (id: string) => Promise<AddressResult>;
}

/**
 * The patient's saved addresses (`GET /api/account/addresses`) and the four writes. Every successful write
 * puts the list the server answered with into the cache, so the page and the checkout card stay in step.
 * A 401 surfaces as `error` (wrap the view in `SignInOnUnauthorized`). Sign-out clears the key.
 */
export function useAddresses(): UseAddresses {
  const { data, error, isLoading, mutate } = useSWR<Address[] | null>(KEY_ADDRESSES, fetchAddresses, { revalidateOnFocus: false });
  const addresses = data ?? undefined;

  const run = useCallback(
    async (path: string, method: string, body?: unknown): Promise<AddressResult> => {
      const { result, addresses: next } = await send(path, method, body);
      if (next) await mutate(next, { revalidate: false });
      return result;
    },
    [mutate],
  );

  const add = useCallback((input: AddressInput, options: SaveOptions = {}) => run(API_ACCOUNT_ADDRESSES, 'POST', { ...input, ...options }), [run]);
  const update = useCallback((id: string, input: AddressInput, options: SaveOptions = {}) => run(apiAccountAddress(id), 'PATCH', { ...input, ...options }), [run]);
  const remove = useCallback((id: string) => run(apiAccountAddress(id), 'DELETE'), [run]);
  const makeDefault = useCallback((id: string) => run(apiAccountAddressDefault(id), 'POST'), [run]);

  return {
    addresses,
    defaultAddress: addresses ? defaultAddress(addresses) : undefined,
    error,
    isLoading,
    add,
    update,
    remove,
    makeDefault,
  };
}
