// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetchJson, HttpError, postJson } from '@/hooks/fetch-json';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_SUMMARY, KEY_GARAGE } from '@/lib/cache-keys';
import type { AccountCustomer } from '@/lib/types';

export type LoginResult = { ok: true } | { ok: false; error: 'invalid-credentials' | 'rate-limited' | 'failed' };

export interface UseAccount {
  /** The signed-in shopper, null when signed out (or while loading). */
  customer: AccountCustomer | null;
  isLoading: boolean;
  isSignedIn: boolean;
  /** Signs in at the store of the page; the anonymous cart merges. Never throws. */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Signs out and clears the cart and account caches. */
  logout: () => Promise<void>;
}

/**
 * The shopper behind the account link and the account area (workstream N; Q builds on it). `GET /api/auth/me` through SWR; sign-in and
 * sign-out refresh everything that depends on who is signed in: the account, the cart and its header count, and the garage (merged).
 * Server-rendered pages read the session themselves; call `router.refresh()` after `login` or `logout` so they follow.
 */
export function useAccount(): UseAccount {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useSWR<{ customer: AccountCustomer | null }>(KEY_ACCOUNT, fetchJson, { revalidateOnFocus: false, shouldRetryOnError: false });

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const result = await postJson<{ customer: AccountCustomer; count: number }>('/api/auth/login', { email, password });
        await mutate({ customer: result.customer }, { revalidate: false });
        await Promise.all([
          globalMutate(KEY_CART_SUMMARY, { count: result.count }, { revalidate: false }),
          globalMutate((key) => typeof key === 'string' && key.startsWith(KEY_CART) && key !== KEY_CART_SUMMARY),
          globalMutate(KEY_GARAGE),
        ]);
        return { ok: true };
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) return { ok: false, error: 'invalid-credentials' };
        if (error instanceof HttpError && error.status === 429) return { ok: false, error: 'rate-limited' };
        return { ok: false, error: 'failed' };
      }
    },
    [globalMutate, mutate],
  );

  const logout = useCallback(async () => {
    try {
      await postJson<{ ok: true }>('/api/auth/logout', {});
    } finally {
      await mutate({ customer: null }, { revalidate: false });
      await Promise.all([globalMutate(KEY_CART, null, { revalidate: false }), globalMutate(KEY_CART_SUMMARY, { count: 0 }, { revalidate: false }), globalMutate(KEY_GARAGE)]);
    }
  }, [globalMutate, mutate]);

  return { customer: data?.customer ?? null, isLoading, isSignedIn: Boolean(data?.customer), login, logout };
}
