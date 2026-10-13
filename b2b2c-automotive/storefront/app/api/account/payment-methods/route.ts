// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/account/payment-methods` -> `{ methods, hasSubscriptions }` (workstream Q-10). Tokenised data only (id, label, last four, expiry).
// `hasSubscriptions` lets the page warn before a delete (the recurring order does not say which method it uses).
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { listPaymentMethods } from '@/lib/ct/account-payment-methods';
import { listSubscriptions } from '@/lib/ct/account-subscriptions';
import { getLocale } from '@/lib/session';

export const GET = accountHandle(async () => {
  const { storeKey, customerId } = await accountSession();
  const { locale } = await getLocale();
  const [methods, subscriptions] = await Promise.all([listPaymentMethods(customerId, locale), listSubscriptions(storeKey, customerId, locale)]);
  return Response.json({ methods, hasSubscriptions: subscriptions.some((s) => s.status === 'active' || s.status === 'paused') }, { headers: NO_STORE });
});
