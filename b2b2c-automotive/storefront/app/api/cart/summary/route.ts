// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { handle } from '@/lib/api';
import { getCartSummary } from '@/lib/ct/cart';
import { getSession } from '@/lib/session';

/** `{ count }`: units in the session's cart (0 without a cart or when it is gone). Per shopper, never cached. */
export const GET = handle(async () => {
  const { storeKey, cartId } = await getSession();
  const summary = storeKey ? await getCartSummary(storeKey, cartId) : { count: 0 };
  return Response.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
});
