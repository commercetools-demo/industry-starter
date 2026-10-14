/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Cart discounts (D-014, D-027). Predicates use backtick-escaped attribute names (hyphens); proven live in G-18.
// Docs: https://docs.commercetools.com/api/projects/cartDiscounts , https://docs.commercetools.com/api/projects/predicates
// Promotions apply to the first order only: every discount here is NonRecurringOrdersOnly (enforced by discounts.test.ts).
import { DISCOUNT_AMOUNTS, DISCOUNT_KEYS, sortOrderOf } from '../../../lib/config/discounts';
import type { CartDiscountDraft } from '../types';
import { ls } from './catalog-types';

const amounts = (a: { USD: number; EUR: number }): { currencyCode: string; centAmount: number }[] => [
  { currencyCode: 'USD', centAmount: a.USD },
  { currencyCode: 'EUR', centAmount: a.EUR },
];

export const cartDiscounts: CartDiscountDraft[] = [
  {
    key: DISCOUNT_KEYS.introFreeMonth,
    name: ls('First month free', 'Erster Monat gratis'),
    description: ls('Plans with a first-month promotion are free for the first order.', 'Tarife mit Aktion für den ersten Monat sind in der ersten Bestellung gratis.'),
    value: { type: 'relative', permyriad: 10000 },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: 'attributes.`intro-free-months` > 0' },
    sortOrder: sortOrderOf(DISCOUNT_KEYS.introFreeMonth),
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
  {
    key: DISCOUNT_KEYS.welcome10,
    name: ls('Welcome offer: $10 off', 'Willkommensangebot: 10 € weniger'),
    description: ls('$10 off the first order with the code WELCOME10.', '10 € Rabatt auf die erste Bestellung mit dem Code WELCOME10.'),
    value: { type: 'absolute', money: amounts(DISCOUNT_AMOUNTS.welcome10) },
    cartPredicate: 'true',
    target: { type: 'totalPrice' },
    sortOrder: sortOrderOf(DISCOUNT_KEYS.welcome10),
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: true,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
];
