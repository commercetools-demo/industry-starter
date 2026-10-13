// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { accountFetcher, accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_SUMMARY, KEY_DEMO_ACCOUNTS, KEY_GARAGE } from '@/lib/cache-keys';
import type { AccountCustomer } from '@/lib/types';

export interface DemoAccount {
  id: string;
  label: string;
}

export interface UseDemoLogin {
  accounts: DemoAccount[] | undefined;
  isLoading: boolean;
  error: unknown;
  /** Signs the chosen demo shopper in (only the id is sent) and refreshes the account, cart and garage caches like a normal sign-in. Throws when refused. */
  signIn: (customerId: string) => Promise<void>;
}

/** The demo shopper picker's data (workstream Q-13a). The list route answers 404 when demo login is off, which is the hook's `error`. */
export function useDemoLogin(): UseDemoLogin {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<{ accounts: DemoAccount[] }>(KEY_DEMO_ACCOUNTS, accountFetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  const signIn = useCallback(
    async (customerId: string) => {
      const result = await accountRequest<{ customer: AccountCustomer; count: number }>('POST', '/api/auth/demo-login', { customerId });
      await mutate(KEY_ACCOUNT, { customer: result.customer }, { revalidate: false });
      await Promise.all([
        mutate(KEY_CART_SUMMARY, { count: result.count }, { revalidate: false }),
        mutate((key) => typeof key === 'string' && key.startsWith(KEY_CART) && key !== KEY_CART_SUMMARY),
        mutate(KEY_GARAGE),
      ]);
    },
    [mutate],
  );
  return { accounts: data?.accounts, isLoading, error, signIn };
}
