// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Saved payment methods (workstream Q-10, D9): the customer's commercetools `PaymentMethod` resources, tokenised data only. Methods are saved
// inside the hosted Checkout (for example for a subscription), so there is no add here. The recurring order does not expose which method backs
// it (OAS `api-RecurringOrder`: only `cart`, `originOrder`, `schedule`), so a delete cannot be blocked by subscription; the page warns instead.
import 'server-only';
import { AccountError, safeId, statusOf } from '@/lib/account/errors';
import { apiRoot } from '@/lib/ct/client';
import { mapPaymentMethod } from '@/lib/mappers/account';
import type { PaymentMethodView } from '@/lib/types';

export async function listPaymentMethods(customerId: string, locale: string): Promise<PaymentMethodView[]> {
  const { body } = await apiRoot.paymentMethods().get({ queryArgs: { where: `customer(id="${safeId(customerId)}")`, limit: 50 } }).execute();
  return body.results.map((m) => mapPaymentMethod(m, locale));
}

/** Deletes one of the customer's own methods; anything else is a 404. */
export async function deletePaymentMethod(customerId: string, id: string): Promise<void> {
  const { body } = await apiRoot.paymentMethods().get({ queryArgs: { where: `id="${safeId(id)}" and customer(id="${safeId(customerId)}")`, limit: 1 } }).execute();
  const method = body.results[0];
  if (!method) throw new AccountError('not-found', 404);
  try {
    await apiRoot.paymentMethods().withId({ ID: method.id }).delete({ queryArgs: { version: method.version } }).execute();
  } catch (error) {
    if (statusOf(error) === 409) throw new AccountError('busy', 409);
    throw error;
  }
}
