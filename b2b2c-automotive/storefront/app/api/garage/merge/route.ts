// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { handle, requireCustomer } from '@/lib/api';
import { mergeGarageOnSignIn } from '@/lib/ct/vehicles';
import { getSession } from '@/lib/session';
import { clearAnonymousGarage, readAnonymousGarage } from '@/lib/vehicles/cookie';
import { toGarageState } from '@/lib/vehicles/garage';

/**
 * Merges the anonymous (cookie) garage into the signed-in customer's garage and clears the cookie. Needs a session with `customerId`.
 * The sign-in route (workstreams Q and N) normally does this itself with `mergeGarageOnSignIn`; this route exists for a client that
 * signed in elsewhere and for tests.
 */
export const POST = handle(async () => {
  const session = await getSession();
  requireCustomer(session);
  const merged = await mergeGarageOnSignIn(session.customerId, await readAnonymousGarage());
  await clearAnonymousGarage();
  return Response.json(toGarageState(merged), { headers: { 'Cache-Control': 'private, no-store' } });
});
