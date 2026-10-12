// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/cart/discount-codes` { code } -> `{ cart, promo }`: `promo` is the state of the code just typed (Applied or Not applied with the
// reason). A code commercetools refuses is not on the cart, so the cart is returned unchanged and only `promo` reports it.
// `DELETE /api/cart/discount-codes` { id } -> `{ cart }` removes a code. Discount codes only, never Direct Discounts (D7).
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { cartJson, cartRouteContext, withSessionCart } from '@/lib/cart-route';
import { getCart } from '@/lib/ct/cart';
import { applyPromoCode, removePromoCode } from '@/lib/ct/cart-discounts';
import { buildCartView } from '@/lib/ct/cart-view';

const apply = z.object({ code: z.string().trim().min(1).max(64) });
const remove = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) });

export const POST = handle(async (request: Request) => {
  const { code } = await parseJson(request, apply);
  const context = await cartRouteContext();
  return withSessionCart(context, async (cartId) => {
    const { cart, promo } = await applyPromoCode(context.session.storeKey, cartId, code);
    const ct = cart ?? (await getCart(context.session.storeKey, cartId));
    if (!ct) throw new ApiError(404, 'Not found');
    return cartJson({ cart: await buildCartView(ct, context.view), promo });
  });
});

export const DELETE = handle(async (request: Request) => {
  const { id } = await parseJson(request, remove);
  const context = await cartRouteContext();
  return withSessionCart(context, async (cartId) => {
    const ct = await removePromoCode(context.session.storeKey, cartId, id);
    return cartJson({ cart: await buildCartView(ct, context.view) });
  });
});
