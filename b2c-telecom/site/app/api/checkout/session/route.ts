/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { checkoutRoute, readCheckoutBody } from '@/lib/checkout-api';
import { startPayment } from '@/lib/ct/checkout';

export const dynamic = 'force-dynamic';

/**
 * Starts the payment for the session's bundle: every check of `prepareCheckout` first, then the hosted Checkout session (or the demo marker
 * while no Checkout application is configured). Never sets a payment strategy on the cart: the hosted Checkout adds the allocation.
 */
export async function POST(request: Request) {
  return checkoutRoute(request, { mutating: true }, async (session, market) => {
    const body = await readCheckoutBody(request);
    const started = await startPayment(session, market, body.expectedTotalCents);
    return { data: { session: started.data }, ...(started.patch ? { patch: started.patch } : {}) };
  });
}
