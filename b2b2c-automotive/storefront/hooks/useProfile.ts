// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR, { useSWRConfig } from 'swr';
import { accountFetcher, accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT, KEY_ACCOUNT_PROFILE, KEY_CART, KEY_CART_SUMMARY, KEY_GARAGE } from '@/lib/cache-keys';
import type { AccountProfile } from '@/lib/types';

export interface ProfileChanges {
  firstName?: string;
  lastName?: string;
  mobile?: string;
  marketingConsent?: boolean;
}

export interface UseProfile {
  profile: AccountProfile | undefined;
  isLoading: boolean;
  error: unknown;
  reload: () => Promise<unknown>;
  /** Every write throws an `AccountApiError` with the machine code (and the password rule for `weak-password`). */
  save: (changes: ProfileChanges) => Promise<void>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Deletes (anonymises) the account and clears every cache that depends on who is signed in. */
  deleteAccount: (password: string, confirm: string) => Promise<void>;
}

export function useProfile(): UseProfile {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<{ profile: AccountProfile }>(KEY_ACCOUNT_PROFILE, accountFetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  const store = async (next: Promise<{ profile: AccountProfile }>) => {
    await mutate(next, { revalidate: false });
    await globalMutate(KEY_ACCOUNT);
  };
  return {
    profile: data?.profile,
    isLoading,
    error,
    reload: () => mutate(),
    save: (changes) => store(accountRequest('PUT', KEY_ACCOUNT_PROFILE, changes)),
    changeEmail: (newEmail, currentPassword) => store(accountRequest('POST', '/api/account/email', { newEmail, currentPassword })),
    changePassword: async (currentPassword, newPassword) => void (await accountRequest('POST', '/api/account/password', { currentPassword, newPassword })),
    deleteAccount: async (password, confirm) => {
      await accountRequest('POST', '/api/account/delete', { password, confirm });
      await Promise.all([
        globalMutate(KEY_ACCOUNT, { customer: null }, { revalidate: false }),
        globalMutate(KEY_CART, null, { revalidate: false }),
        globalMutate(KEY_CART_SUMMARY, { count: 0 }, { revalidate: false }),
        globalMutate(KEY_GARAGE),
      ]);
    },
  };
}
