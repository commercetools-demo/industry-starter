// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `PUT /api/cart/delivery` { mode: 'pickup' | 'ship' } -> `{ cart }` with the new fee and tax. The choice presets the cart for the hosted
// Checkout (D19); no address is collected here.
import { z } from 'zod';
import { handle, parseJson } from '@/lib/api';
import { cartJson, cartRouteContext, withSessionCart } from '@/lib/cart-route';
import { pickupPlaceOf } from '@/lib/ct/cart';
import { buildCartView, scopeOf } from '@/lib/ct/cart-view';
import { setDelivery } from '@/lib/ct/delivery';

const body = z.object({ mode: z.enum(['pickup', 'ship']) });

export const PUT = handle(async (request: Request) => {
  const { mode } = await parseJson(request, body);
  const context = await cartRouteContext();
  return withSessionCart(context, async (cartId) => {
    const { scope } = await scopeOf(context.view);
    const place = await pickupPlaceOf(context.session.storeKey, context.locale, scope.branchKey);
    const updated = await setDelivery(context.session.storeKey, cartId, mode, place);
    return cartJson({ cart: await buildCartView(updated, context.view) });
  });
});
