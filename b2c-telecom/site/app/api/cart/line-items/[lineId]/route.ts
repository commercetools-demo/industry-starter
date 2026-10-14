/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { cartResponse, invalidBody, readBody } from '@/lib/cart-api';
import { removeFromBundle, setLineQuantity } from '@/lib/ct/bundle';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ lineId: string }> };

/** Sets the quantity (phone plan: number of lines). The answer is the full server cart: totals are never computed on the client. */
export async function PATCH(request: Request, { params }: Context) {
  const { lineId } = await params;
  return cartResponse(async (session, market) => {
    const { quantity } = await readBody(request);
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) throw invalidBody('quantity must be a whole number.');
    return setLineQuantity(session, market, lineId, quantity);
  });
}

/** Removes a line. A plan with add-ons or equipment answers 409 HAS_DEPENDENTS until the buyer confirms with `?cascade=true`. */
export async function DELETE(request: Request, { params }: Context) {
  const { lineId } = await params;
  const cascade = new URL(request.url).searchParams.get('cascade') === 'true';
  return cartResponse((session, market) => removeFromBundle(session, market, lineId, cascade));
}
