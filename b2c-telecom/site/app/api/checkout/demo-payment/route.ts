/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { checkoutRoute, readCheckoutBody } from '@/lib/checkout-api';
import { placeDemoOrder } from '@/lib/ct/checkout';

export const dynamic = 'force-dynamic';

/** Demo-mode payment (no Checkout application configured, see `isDemoPayment`): 404 otherwise. Places the order as the hosted Checkout would. */
export async function POST(request: Request) {
  return checkoutRoute(request, { mutating: true }, async (session, market) => placeDemoOrder(session, market, (await readCheckoutBody(request)).expectedTotalCents));
}
