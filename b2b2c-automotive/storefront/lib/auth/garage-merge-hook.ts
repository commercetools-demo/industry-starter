// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The garage half of "Anonymous cart and garage merge" (workstream J contract, registered by N, Q-03 may extend): after sign-in the
// cookie garage is merged into the customer's `malva-customer.garage` (union by id, anonymous active vehicle wins, at most five) and the
// cookie is cleared.
import 'server-only';
import { registerSignInHook, type SignInHookContext } from '@/lib/auth/sign-in-hooks';
import { mergeGarageOnSignIn } from '@/lib/ct/vehicles';
import { clearAnonymousGarage, readAnonymousGarage } from '@/lib/vehicles/cookie';

export const GARAGE_HOOK_NAME = 'garage-merge';

export async function garageMergeHook({ customerId }: SignInHookContext): Promise<void> {
  await mergeGarageOnSignIn(customerId, await readAnonymousGarage());
  await clearAnonymousGarage();
}

registerSignInHook(garageMergeHook, GARAGE_HOOK_NAME);
