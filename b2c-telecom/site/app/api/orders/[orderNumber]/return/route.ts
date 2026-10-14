/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { orderActionRoute } from '@/lib/api/order-actions-api';
import { requestReturn } from '@/lib/ct/post-purchase';

export const dynamic = 'force-dynamic';

/**
 * Records a return request for devices of the signed-in customer's order (within 30 days). The request is validated against what is
 * still returnable, so a repeated request is refused (QUANTITY_TOO_HIGH) instead of creating a second return.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  return orderActionRoute(request, params, 'RETURN_FAILED', ({ orderNumber, customerId, body, locale }) => requestReturn(orderNumber, customerId, body, locale));
}
