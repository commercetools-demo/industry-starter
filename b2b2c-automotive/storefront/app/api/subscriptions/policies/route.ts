// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/subscriptions/policies` (workstream M): the recurrence policies of "Subscribe and save" in the shopper's language.
//   200 { policies: [{ key, label }] }   empty when subscriptions are switched off or no `mau-rp-*` policy exists
// Client code calls it through `useSubscriptionPolicies` only.
import { handle } from '@/lib/api';
import { listRecurrencePolicies } from '@/lib/ct/recurrence-policies';
import { getLocale } from '@/lib/session';
import { subscriptionsPurchaseEnabled } from '@/lib/subscriptions/config';

export const GET = handle(async () => {
  if (!subscriptionsPurchaseEnabled()) return Response.json({ policies: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  const { locale } = await getLocale();
  const policies = await listRecurrencePolicies(locale);
  return Response.json({ policies }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
});
