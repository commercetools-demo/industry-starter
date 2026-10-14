/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Discount amounts in cents, used by BOTH the seeded Cart Discounts (scripts/seed/data/cart-discounts*.ts) and the
// "Discounts" text of the Broadband Facts label, so no figure exists in two places.
// Promotions apply to the first order only (every Cart Discount is NonRecurringOrdersOnly, see first-order-promotions): the first
// month promotion plus two codes. Recurring orders are charged the standing price.
export const DISCOUNT_AMOUNTS = {
  codeCable5: { USD: 500, EUR: 500 },
  welcome10: { USD: 1000, EUR: 1000 },
} as const;

/** Cart Discount keys the storefront reads (`includedDiscounts[].discount.key`). */
export const DISCOUNT_KEYS = {
  introFreeMonth: 'malva-cd-intro-free-month',
  welcome10: 'malva-cd-welcome-10',
  codeCable5: 'malva-cd-code-cable5',
} as const;

/**
 * Intended order of application, first to last. The platform applies the HIGHER sortOrder first, so the first entry gets the highest
 * value. A Cart Discount that targets the total price is applied last by the platform whatever its rank. The seed derives every
 * `sortOrder` from this list and a test fails if a discount is missing or the order drifts.
 */
export const DISCOUNT_APPLICATION_ORDER = [DISCOUNT_KEYS.introFreeMonth, DISCOUNT_KEYS.codeCable5, DISCOUNT_KEYS.welcome10] as const;

/** `0.9` for the first entry, `0.8` for the second, and so on (higher applies first). */
export function sortOrderOf(key: (typeof DISCOUNT_APPLICATION_ORDER)[number]): string {
  const index = DISCOUNT_APPLICATION_ORDER.indexOf(key);
  if (index < 0) throw new Error(`Discount ${key} is not in DISCOUNT_APPLICATION_ORDER`);
  return `0.${9 - index}`;
}

/** The Discount Code `MALVA-CABLE5` (workstream M seeds it). */
export const CABLE5_CODE = { key: 'malva-dc-cable5', code: 'MALVA-CABLE5' } as const;
