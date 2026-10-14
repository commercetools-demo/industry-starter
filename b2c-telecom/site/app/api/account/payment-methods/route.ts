/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { accountRoute } from '@/lib/api/account-api';
import { paymentMethodViews, withPaymentErrors } from '@/lib/api/payment-methods-api';

export const dynamic = 'force-dynamic';

/** The signed-in customer's stored payment methods (descriptor and default flag only). List-only: there is no create route (D-032). */
export async function GET(request: Request) {
  return accountRoute(request, {}, ({ session }) => withPaymentErrors(() => paymentMethodViews(session.customerId)));
}
