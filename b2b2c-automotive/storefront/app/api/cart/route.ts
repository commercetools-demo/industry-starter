// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/cart` -> `{ cart }` (null without a cart; a cart that is gone, not Active or of another store is cleared from the session).
// `POST /api/cart` -> `{ cart }` creates an empty cart for the session on demand. Adding a line is `POST /api/cart/lines` (alias `/items`).
import { handle } from '@/lib/api';
import { cartJson, cartRouteContext, dropSessionCart } from '@/lib/cart-route';
import { createCart } from '@/lib/ct/cart';
import { buildCartView, loadCartView } from '@/lib/ct/cart-view';
import { getSession, updateSession } from '@/lib/session';

export const GET = handle(async () => {
  const session = await getSession();
  if (!session.storeKey || !session.cartId) return cartJson({ cart: null });
  const { view } = await cartRouteContext();
  const { cart, drop } = await loadCartView(session.cartId, view);
  if (drop) await dropSessionCart();
  return cartJson({ cart });
});

export const POST = handle(async () => {
  const { session, view } = await cartRouteContext();
  const ct = await createCart({ storeKey: session.storeKey, locale: view.locale, ...(session.customerId ? { customerId: session.customerId } : { anonymousId: session.anonymousId ?? crypto.randomUUID() }) });
  if (!session.customerId && ct.anonymousId) {
    const anonymousId = ct.anonymousId;
    await updateSession((s) => ({ ...s, cartId: ct.id, anonymousId }));
  } else {
    await updateSession((s) => ({ ...s, cartId: ct.id }));
  }
  return cartJson({ cart: await buildCartView(ct, view) });
});
