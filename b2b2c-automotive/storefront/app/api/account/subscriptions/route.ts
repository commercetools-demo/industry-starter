// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/account/subscriptions` -> `{ offered, subscriptions, policies }` (workstream Q-12, D10). `offered` is true when subscriptions are
// purchasable or the customer has recurring orders (the menu shows the item then); `policies` are the seeded `mau-rp-*` frequencies for the change select.
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { listSubscriptions, subscriptionsOffered } from '@/lib/ct/account-subscriptions';
import { listRecurrencePolicies } from '@/lib/ct/recurrence-policies';
import { getLocale } from '@/lib/session';

export const GET = accountHandle(async () => {
  const { storeKey, customerId } = await accountSession();
  const { locale } = await getLocale();
  const [offered, subscriptions, policies] = await Promise.all([subscriptionsOffered(storeKey, customerId), listSubscriptions(storeKey, customerId, locale), listRecurrencePolicies(locale)]);
  return Response.json({ offered: offered || subscriptions.length > 0, subscriptions, policies }, { headers: NO_STORE });
});
