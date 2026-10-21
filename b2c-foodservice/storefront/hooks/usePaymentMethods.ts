'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyPaymentMethods } from '@/lib/cache-keys';
import type { PaymentMethodView } from '@/lib/types';

interface MethodsResponse { methods: PaymentMethodView[]; hostedOnly?: boolean }

/** The customer's saved payment methods (saved by the hosted Checkout; there is no add). Remove and make default. */
export function usePaymentMethods() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useAccountSwr<MethodsResponse>(
    customerId ? keyPaymentMethods(customerId) : null,
    '/api/account/payment-methods',
  );

  const adopt = useCallback(
    async (res: MethodsResponse) => {
      if (customerId) await mutate(keyPaymentMethods(customerId), { methods: res.methods, hostedOnly: true }, { revalidate: false });
    },
    [customerId, mutate],
  );

  const remove = useCallback(
    async (id: string) => adopt(await fetchJson<MethodsResponse>(`/api/account/payment-methods/${encodeURIComponent(id)}`, { method: 'DELETE' })),
    [adopt],
  );
  const makeDefault = useCallback(
    async (id: string) => adopt(await fetchJson<MethodsResponse>(`/api/account/payment-methods/${encodeURIComponent(id)}/default`, { method: 'POST' })),
    [adopt],
  );

  return { methods: data?.methods ?? null, isLoading, isError: Boolean(error), reload, remove, makeDefault };
}
