// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Subscription purchase settings (workstream M, D13; N-03 and O read them too).

/** `RecurrenceInfo.priceSelectionMode`: each renewal uses the then-current standalone price. */
export const SUBSCRIPTION_PRICE_MODE = 'Dynamic' as const;

/** Keys of the seeded recurrence policies start with this prefix; only those are offered. */
export const POLICY_KEY_PREFIX = 'mau-rp-';

/**
 * "Subscribe and save" is offered unless `SUBSCRIPTIONS_PURCHASE_ENABLED=false` (workstream O sets that when the installed Stripe
 * connector cannot process recurring orders). Server side only: the page passes the result to the client as a prop.
 */
export function subscriptionsPurchaseEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SUBSCRIPTIONS_PURCHASE_ENABLED?.trim().toLowerCase() !== 'false';
}
