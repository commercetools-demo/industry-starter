/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Promo code status for a cart (spec "Promo codes visible with reasons"). Pure; the storefront cart (N) reuses it through
// components/discounts/DiscountCodeStatus.tsx. `key` is the message key suffix under `catalog.codeStatus`.
export type DiscountCodeState = 'NotActive' | 'NotValid' | 'DoesNotMatchCart' | 'MatchesCart' | 'MaxApplicationReached' | 'ApplicationStoppedByPreviousDiscount';

export interface CodeStatus {
  key: DiscountCodeState;
  label: string;
  applied: boolean;
}

const LABELS: Record<DiscountCodeState, string> = {
  MatchesCart: 'Applied',
  DoesNotMatchCart: "Not applied: cart doesn't match",
  NotActive: 'Not applied: the code is not active',
  NotValid: 'Not applied: the code is not valid',
  MaxApplicationReached: 'Not applied: the code has reached its maximum number of uses',
  ApplicationStoppedByPreviousDiscount: 'Not applied: stopped by a discount with a higher priority',
};

export function codeStatus(state: DiscountCodeState): CodeStatus {
  return { key: state, label: LABELS[state], applied: state === 'MatchesCart' };
}

export const CODE_STATES = Object.keys(LABELS) as DiscountCodeState[];
