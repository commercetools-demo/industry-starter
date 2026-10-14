// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/auth/me` -> `{ customer }`: the signed-in shopper (no secrets) or `{ customer: null }`. A session customer that is gone or does not
// belong to the session's store (the in-store endpoint answers 404) is treated as signed out and removed from the session.
import { handle } from '@/lib/api';
import { inStore } from '@/lib/ct/in-store';
import { maskAccountCustomer } from '@/lib/impersonation/state';
import { mapCustomer } from '@/lib/mappers/customer';
import { getSession, updateSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const GET = handle(async () => {
  const { storeKey, customerId, impersonatedBy } = await getSession();
  if (!storeKey || !customerId) return Response.json({ customer: null }, { headers: NO_STORE });
  try {
    const { body } = await inStore(storeKey).customers().withId({ ID: customerId }).get().execute();
    const customer = mapCustomer(body);
    // A seller shopping as the customer (V-06) sees the names only: masked e-mail, no phone, no addresses.
    return Response.json({ customer: impersonatedBy ? maskAccountCustomer(customer) : customer }, { headers: NO_STORE });
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
    if (status !== 404) throw error;
    await updateSession((s) => {
      const next = { ...s };
      delete next.customerId;
      return next;
    });
    return Response.json({ customer: null }, { headers: NO_STORE });
  }
});
