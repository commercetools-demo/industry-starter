// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The requests of the cart page (workstream N-10). Only `useCart` calls them; components never fetch `/api/...` themselves.
import { fetchJson } from '@/hooks/fetch-json';
import type { CartResponse, DeliveryMode } from '@/lib/types';

const JSON_HEADERS = { 'content-type': 'application/json' };
const send = (url: string, method: string, body?: unknown) => fetchJson<CartResponse>(url, { method, headers: JSON_HEADERS, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const cartActions = {
  setQuantity: (lineId: string, quantity: number) => send(`/api/cart/items/${encodeURIComponent(lineId)}`, 'PATCH', { quantity }),
  removeLine: (lineId: string) => send(`/api/cart/items/${encodeURIComponent(lineId)}`, 'DELETE'),
  setDelivery: (mode: DeliveryMode) => send('/api/cart/delivery', 'PUT', { mode }),
  applyCode: (code: string) => send('/api/cart/discount-codes', 'POST', { code }),
  removeCode: (id: string) => send('/api/cart/discount-codes', 'DELETE', { id }),
};
