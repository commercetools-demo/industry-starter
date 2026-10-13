// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/account/profile` -> `{ profile }`; `PUT` { firstName?, lastName?, mobile?, marketingConsent? } -> `{ profile }` (workstream Q-11).
// The customer is the session's (never from the request). Consent changes write `marketingConsentAt`; nothing is ever sent to the shopper.
import { z } from 'zod';
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { parseJson } from '@/lib/api';
import { getProfile, updateProfile } from '@/lib/ct/account-customer';

const body = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  mobile: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9 +()./-]*$/, 'Invalid mobile number')
    .optional(),
  marketingConsent: z.boolean().optional(),
});

export const GET = accountHandle(async () => {
  const { storeKey, customerId } = await accountSession();
  return Response.json({ profile: await getProfile(storeKey, customerId) }, { headers: NO_STORE });
});

export const PUT = accountHandle(async (request: Request) => {
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, body);
  return Response.json({ profile: await updateProfile(storeKey, customerId, input) }, { headers: NO_STORE });
});
