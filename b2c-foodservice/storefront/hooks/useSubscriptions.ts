'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyRecurringOrders } from '@/lib/cache-keys';
import type { Subscription, SubscriptionAction, SubscriptionsResponse } from '@/lib/types';

/**
 * The signed-in customer's subscriptions (recurring orders) and pending ones. SWR key `keyRecurringOrders(customerId)`,
 * revalidated on focus (the platform changes them), deduped for 5 s. With `originOrderId` the list is narrowed to one order
 * (the confirmation page); `refreshInterval` lets that page retry while the platform is still creating the subscription.
 */
export function useSubscriptions(opts: { originOrderId?: string; refreshInterval?: number; enabled?: boolean } = {}) {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const origin = opts.originOrderId;
  const key = customerId && opts.enabled !== false ? ([...keyRecurringOrders(customerId), ...(origin ? [origin] : [])] as const) : null;
  const url = origin ? `/api/recurring-orders?originOrderId=${encodeURIComponent(origin)}` : '/api/recurring-orders';
  const { data, error, isLoading, mutate } = useAccountSwr<SubscriptionsResponse>(key, url, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
    ...(opts.refreshInterval ? { refreshInterval: opts.refreshInterval } : {}),
  });
  return {
    subscriptions: data?.subscriptions ?? [],
    pending: data?.pending ?? [],
    isLoading: customer === undefined || (Boolean(key) && isLoading),
    error: error ?? null,
    mutate,
  };
}

/**
 * One change on one subscription. The response (the state after the change) replaces that subscription in the list cache, then
 * one background revalidation follows. Failures throw `ApiError` with the server's domain code (`invalid_state`, ...).
 */
export function useSubscriptionActions() {
  const { mutate } = useSWRConfig();
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  return useCallback(
    async (id: string, action: SubscriptionAction): Promise<Subscription> => {
      const res = await fetchJson<{ subscription: Subscription }>(`/api/recurring-orders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (customerId) {
        const key = keyRecurringOrders(customerId);
        await mutate(
          key,
          (current: SubscriptionsResponse | undefined) =>
            current ? { ...current, subscriptions: current.subscriptions.map((s) => (s.id === id ? res.subscription : s)) } : current,
          { revalidate: false },
        );
        void mutate(key);
      }
      return res.subscription;
    },
    [mutate, customerId],
  );
}
