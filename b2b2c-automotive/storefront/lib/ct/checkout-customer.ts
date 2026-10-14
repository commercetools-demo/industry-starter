// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The email of the signed-in customer, to prefill the hosted Checkout (best effort: a failure means the shopper types it).
import 'server-only';
import { inStore } from '@/lib/ct/in-store';

export async function getCheckoutCustomerEmail(storeKey: string, customerId: string): Promise<string | undefined> {
  try {
    const { body } = await inStore(storeKey).customers().withId({ ID: customerId }).get().execute();
    return body.email || undefined;
  } catch {
    return undefined;
  }
}
