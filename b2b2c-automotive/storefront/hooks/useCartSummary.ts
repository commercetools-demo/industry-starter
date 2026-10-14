// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetch-json';
import { KEY_CART_SUMMARY } from '@/lib/cache-keys';

/** Units in the cart for the header badge; 0 while loading or when the request fails (the badge never blocks the page). */
export function useCartSummary(): { count: number; isLoading: boolean } {
  const { data, isLoading } = useSWR<{ count: number }>(KEY_CART_SUMMARY, fetchJson, { revalidateOnFocus: true, shouldRetryOnError: false });
  return { count: data?.count ?? 0, isLoading };
}
