/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/session';

/** Drops the identity and the cart id; the (customer's) cart stays in commercetools for the next sign-in. */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  await updateSession(
    { customerId: undefined, customerEmail: undefined, customerFirstName: undefined, customerLastName: undefined, cartId: undefined, lastOrderId: undefined },
    res,
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
