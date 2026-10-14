// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR from 'swr';
import { accountFetcher, accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT_SUBSCRIPTIONS } from '@/lib/cache-keys';
import type { PolicyOption, SubscriptionAction, SubscriptionView } from '@/lib/types';

interface SubscriptionsState {
  offered: boolean;
  subscriptions: SubscriptionView[];
  policies: PolicyOption[];
}

export interface UseSubscriptions {
  subscriptions: SubscriptionView[] | undefined;
  policies: PolicyOption[];
  isLoading: boolean;
  error: unknown;
  reload: () => Promise<unknown>;
  /** Runs one action and replaces the subscription with the answer (its next date is the API's). Throws an `AccountApiError` when refused. */
  run: (id: string, action: SubscriptionAction, policyKey?: string) => Promise<SubscriptionView>;
}

export function useSubscriptions(): UseSubscriptions {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionsState>(KEY_ACCOUNT_SUBSCRIPTIONS, accountFetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  return {
    subscriptions: data?.subscriptions,
    policies: data?.policies ?? [],
    isLoading,
    error,
    reload: () => mutate(),
    run: async (id, action, policyKey) => {
      const { subscription } = await accountRequest<{ subscription: SubscriptionView }>('PUT', `${KEY_ACCOUNT_SUBSCRIPTIONS}/${encodeURIComponent(id)}`, { action, ...(policyKey ? { policyKey } : {}) });
      await mutate((current) => (current ? { ...current, subscriptions: current.subscriptions.map((s) => (s.id === id ? subscription : s)) } : current), { revalidate: false });
      return subscription;
    },
  };
}
