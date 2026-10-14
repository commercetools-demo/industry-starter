/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

// Client side of workstream V's screens (Customers, Subscriptions, Returns, Reviews): SWR reads and plain async writes against
// `/api/seller/**`. The only place these screens reach the network (hook-only fetching). The server re-checks the store and the role on
// every call. Types are imported with `import type`, so no server module reaches the browser.
import useSWR from 'swr';
import type { ReturnStatus } from '@/lib/contracts/return-item';
import type {
  CustomerDetail,
  CustomerList,
  CustomerNote,
  CustomerTab,
  OrderForReturn,
  ReturnDetail,
  ReturnList,
  ReviewList,
  ReviewTab,
  ReviewVisibility,
  ShopAsHandoff,
  SubscriptionAction,
  SubscriptionAuditEntry,
  SubscriptionList,
} from '@/lib/v-types';
import { sendJson, type CatalogResult } from './catalogApi';
import { getJson, swrFetcher } from './http';

export type { CatalogResult };

const q = (storeKey: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams({ storeKey });
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') params.set(k, String(v));
  return params.toString();
};
const enc = encodeURIComponent;
function useRead<T>(url: string | null) {
  return useSWR<T>(url, swrFetcher<T>, { revalidateOnFocus: false });
}

// ---- Customers ----
export const useCustomers = (storeKey: string, tab: CustomerTab, query: string, offset: number) =>
  useRead<CustomerList>(`/api/seller/customers?${q(storeKey, { tab, q: query, offset })}`);
export const useCustomerDetail = (storeKey: string, id: string, locale: string) => useRead<CustomerDetail>(`/api/seller/customers/${enc(id)}?${q(storeKey, { locale })}`);
export const customerApi = {
  addNote: (storeKey: string, id: string, text: string) => sendJson<{ notes: CustomerNote[] }>('POST', `/api/seller/customers/${enc(id)}/notes`, { storeKey, text }),
  shopAs: (storeKey: string, id: string) => sendJson<ShopAsHandoff>('POST', `/api/seller/customers/${enc(id)}/shop-as`, { storeKey }),
  markDelivered: (storeKey: string, orderNumber: string) => sendJson<{ deliveredAt: string }>('POST', `/api/seller/orders/${enc(orderNumber)}/delivered`, { storeKey }),
};

// ---- Subscriptions ----
export const useSubscriptions = (storeKey: string, locale: string) => useRead<SubscriptionList>(`/api/seller/subscriptions?${q(storeKey, { locale })}`);
export const useSubscriptionAudit = (storeKey: string, id: string | null) => useRead<{ entries: SubscriptionAuditEntry[] }>(id ? `/api/seller/subscriptions/${enc(id)}/audit?${q(storeKey)}` : null);
export const subscriptionApi = {
  run: (storeKey: string, id: string, action: SubscriptionAction) =>
    sendJson<{ status: string }>('POST', `/api/seller/subscriptions/${enc(id)}/${action}`, action === 'cancel' ? { storeKey, confirm: true } : { storeKey }),
};

// ---- Returns ----
export const useReturns = (storeKey: string, tab: 'open' | 'closed', locale: string) => useRead<ReturnList>(`/api/seller/returns?${q(storeKey, { tab, locale })}`);
export const useReturn = (storeKey: string, number: string | null, locale: string) => useRead<ReturnDetail>(number ? `/api/seller/returns/${enc(number)}?${q(storeKey, { locale })}` : null);
export const returnApi = {
  lookupOrder: (storeKey: string, orderNumber: string) => getJson<OrderForReturn>(`/api/seller/orders/${enc(orderNumber)}?${q(storeKey)}`),
  create: (storeKey: string, input: { orderNumber: string; items: { lineItemId: string; quantity: number }[]; reason: string; comment?: string }) =>
    sendJson<{ returnNumber: string; tracking: string }>('POST', '/api/seller/returns', { storeKey, ...input }),
  transition: (storeKey: string, number: string, input: { to: ReturnStatus; refundCents?: number; reason?: string }) =>
    sendJson<{ status: ReturnStatus; refund?: { outcome?: string; noPayment?: boolean } }>('POST', `/api/seller/returns/${enc(number)}/transition`, { storeKey, ...input }),
};

// ---- Reviews ----
export const useReviews = (storeKey: string, tab: ReviewTab, locale: string) => useRead<ReviewList>(`/api/seller/reviews?${q(storeKey, { tab, locale })}`);
export const reviewApi = {
  reply: (storeKey: string, id: string, text: string) => sendJson<{ id: string }>('POST', `/api/seller/reviews/${enc(id)}/reply`, { storeKey, text }),
  setVisibility: (storeKey: string, id: string, visibility: ReviewVisibility) => sendJson<{ id: string }>('POST', `/api/seller/reviews/${enc(id)}/visibility`, { storeKey, visibility }),
};
