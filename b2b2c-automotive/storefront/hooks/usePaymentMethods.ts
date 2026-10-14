// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR from 'swr';
import { accountFetcher, accountRequest } from '@/hooks/account-fetch';
import { KEY_ACCOUNT_PAYMENT_METHODS } from '@/lib/cache-keys';
import type { PaymentMethodView } from '@/lib/types';

interface MethodsState {
  methods: PaymentMethodView[];
  hasSubscriptions: boolean;
}

export interface UsePaymentMethods {
  methods: PaymentMethodView[] | undefined;
  hasSubscriptions: boolean;
  isLoading: boolean;
  error: unknown;
  reload: () => Promise<unknown>;
  /** Throws an `AccountApiError` when the delete is refused. */
  remove: (id: string) => Promise<void>;
}

/** The saved payment methods (tokenised, read only except delete: methods are saved inside the hosted Checkout). */
export function usePaymentMethods(): UsePaymentMethods {
  const { data, error, isLoading, mutate } = useSWR<MethodsState>(KEY_ACCOUNT_PAYMENT_METHODS, accountFetcher, { revalidateOnFocus: false, shouldRetryOnError: false });
  return {
    methods: data?.methods,
    hasSubscriptions: data?.hasSubscriptions ?? false,
    isLoading,
    error,
    reload: () => mutate(),
    remove: async (id) => {
      await accountRequest('DELETE', `${KEY_ACCOUNT_PAYMENT_METHODS}/${encodeURIComponent(id)}`);
      await mutate((current) => (current ? { ...current, methods: current.methods.filter((m) => m.id !== id) } : current), { revalidate: false });
    },
  };
}
