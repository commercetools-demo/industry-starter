// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { accountRequest } from '@/hooks/account-fetch';
import { KEY_CART, KEY_CART_SUMMARY } from '@/lib/cache-keys';

export interface ReturnRequestBody {
  items: Array<{ lineItemId: string; quantity: number }>;
  reason: string;
  comment?: string;
}

export interface UseOrderActions {
  /** Throws an `AccountApiError` with the machine code (`RETURN_WINDOW_CLOSED`, `NOT_DELIVERED`, `NOTHING_LEFT`, `quantity-exceeds`, ...). */
  requestReturn: (orderNumber: string, body: ReturnRequestBody) => Promise<{ returnNumber: string; tracking: string }>;
  /** Adds the lines of the order to the cart and refreshes the cart caches. */
  reorder: (orderNumber: string) => Promise<{ added: number; skipped: number; count: number }>;
}

export function useOrderActions(): UseOrderActions {
  const { mutate } = useSWRConfig();
  const requestReturn = useCallback((orderNumber: string, body: ReturnRequestBody) => accountRequest<{ returnNumber: string; tracking: string }>('POST', `/api/account/orders/${encodeURIComponent(orderNumber)}/return`, body), []);
  const reorder = useCallback(
    async (orderNumber: string) => {
      const result = await accountRequest<{ added: number; skipped: number; count: number }>('POST', `/api/account/orders/${encodeURIComponent(orderNumber)}/reorder`);
      await Promise.all([mutate(KEY_CART_SUMMARY, { count: result.count }, { revalidate: false }), mutate((key) => typeof key === 'string' && key.startsWith(KEY_CART) && key !== KEY_CART_SUMMARY)]);
      return result;
    },
    [mutate],
  );
  return { requestReturn, reorder };
}
