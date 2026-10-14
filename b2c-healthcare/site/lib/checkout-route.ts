/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { requireCustomer } from '@/lib/api';
import { checkoutNow } from '@/lib/checkout/config';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { requirePatient, rxContextOf } from '@/lib/rx-route';

/** Shared by the checkout Route Handlers: the signed-in customer, their patient record and the cut-off clock. */
export async function checkoutContext(): Promise<CheckoutContext> {
  const session = await requireCustomer();
  const patient = await requirePatient(session.customerId);
  return { patient, customerId: session.customerId, cartId: session.cartId, rx: rxContextOf(session), now: checkoutNow() };
}
