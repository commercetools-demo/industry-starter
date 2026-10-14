/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, requireCustomer } from '@/lib/api';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { setDefaultMethod } from '@/lib/ct/payment-methods';
import { withProvider } from '@/lib/payment-route';

/** POST /api/payment-methods/:id/default: makes it the default (the previous default is cleared). Answers the new list. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    return { methods: await withProvider(async () => setDefaultMethod(session.customerId, id, await getPaymentProvider())) };
  });
}
