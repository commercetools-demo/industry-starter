/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { checkoutRoute } from '@/lib/checkout-api';
import { readReview } from '@/lib/ct/checkout';

export const dynamic = 'force-dynamic';

/** The review data; also the window-focus total check of the payment step. */
export async function GET(request: Request) {
  return checkoutRoute(request, {}, async (session, market) => ({ data: { review: await readReview(session, market) } }));
}
