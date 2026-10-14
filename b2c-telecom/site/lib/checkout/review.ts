/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { CheckoutReview, CheckoutState, Money } from '@/lib/types';
import { computeServiceStart } from './serviceStart';

const sum = (amounts: Money[], currencyCode: string): Money => ({ centAmount: amounts.reduce((total, amount) => total + amount.centAmount, 0), currencyCode });

/**
 * Review data, derived from the cart state alone (schedules and labels ride on the mapped plan lines): due today is the cart's due-today
 * figure (lib/pricing/summary), "monthly after today" is the cart's "then monthly" (the standing price of each recurring line, because
 * promotions apply to the first order only), the contract total is the sum of the committed plans' `totalContractValue`. Pure: the
 * server and the client derive the same review from the same state.
 */
export function buildReview(state: CheckoutState, today: string): CheckoutReview {
  const { cart } = state;
  const currency = cart.currencyCode;
  const totals = cart.lines.flatMap((line) => (line.schedule && !line.schedule.openEnded && line.schedule.totalContractValue ? [line.schedule.totalContractValue] : []));
  return {
    state,
    serviceStartDate: computeServiceStart(cart.lines, today),
    dueToday: cart.summary.dueToday,
    monthlyAfterToday: cart.summary.thenMonthly,
    contractTotal: totals.length > 0 ? sum(totals, currency) : null,
  };
}
