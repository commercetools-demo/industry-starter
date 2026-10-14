// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_SUMMARY, KEY_GARAGE } from '@/lib/cache-keys';
import type { AccountCustomer } from '@/lib/types';

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  marketingConsent: boolean;
}

export interface UseAuthActions {
  /** Creates the account and signs in (the anonymous cart and garage merge on the server). Throws an `AccountApiError` (`weak-password` with `rule`, `register-failed`, 429). */
  register: (input: RegisterInput) => Promise<void>;
  /** Asks for the on-screen reset link. `resetPath` is absent when the reset is turned off. */
  requestReset: (email: string) => Promise<{ resetPath?: string }>;
  /** Sets the new password. Throws an `AccountApiError` (`invalid-token`, `weak-password`). It does not sign in. */
  resetPassword: (token: string, password: string) => Promise<void>;
}

/** Register and password reset. After a register the caches that depend on who is signed in are refreshed, like `useAccount().login`. */
export function useAuthActions(): UseAuthActions {
  const { mutate } = useSWRConfig();
  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await accountRequest<{ customer: AccountCustomer; count: number }>('POST', '/api/auth/register', input);
      await mutate(KEY_ACCOUNT, { customer: result.customer }, { revalidate: false });
      await Promise.all([
        mutate(KEY_CART_SUMMARY, { count: result.count }, { revalidate: false }),
        mutate((key) => typeof key === 'string' && key.startsWith(KEY_CART) && key !== KEY_CART_SUMMARY),
        mutate(KEY_GARAGE),
      ]);
    },
    [mutate],
  );
  const requestReset = useCallback((email: string) => accountRequest<{ ok: true; resetPath?: string }>('POST', '/api/auth/forgot-password', { email }), []);
  const resetPassword = useCallback(async (token: string, password: string) => void (await accountRequest('POST', '/api/auth/reset-password', { token, password })), []);
  return { register, requestReset, resetPassword };
}
