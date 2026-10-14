/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Definitions of introductory periods and stepped term prices. Empty since promotions apply to the first order only.
export const MONTHLY_POLICY_KEY = 'malva-monthly' as const;

export interface IntroDef {
  offerKey: string;
  term: 0 | 12 | 24;
  months: number;
  amountCents: { USD: number; EUR: number };
}
export interface StepDef {
  offerKey: string;
  term: 12 | 24;
  coversMonths: number;
  steps: { fromMonth: number; deltaCents: { USD: number; EUR: number } }[];
}

// Promotions apply to the first order only, so no introductory price or price step is defined for new orders. The two lists stay so that
// the schedule library keeps reading intro and step periods stored on orders placed before this change (tests fill them as needed).
export const INTRO_DEFS: IntroDef[] = [];

export const STEP_DEFS: StepDef[] = [];

/** Cart Discount keys, one per IntroDef: malva-cd-intro-<offerKey-without-malva-offer->-<term>. */
export const INTRO_DISCOUNT_KEY_PREFIX = 'malva-cd-intro-';

/** Install lead time in days (D-023): expected service start = order date + lead. Cable 5, everything else 0. */
export const INSTALL_LEAD_DAYS_CABLE = 5;
