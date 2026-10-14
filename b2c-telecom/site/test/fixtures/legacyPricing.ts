/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Introductory prices and price steps are no longer sold (promotions apply to the first order only), so INTRO_DEFS and STEP_DEFS are
// empty. Orders placed before that change still carry intro and step periods, and the schedule library keeps reading them. Tests that
// cover that reading install the definitions that used to be shipped.
import { INTRO_DEFS, STEP_DEFS, type IntroDef, type StepDef } from '@/lib/config/pricing';

export const LEGACY_INTRO_DEFS: IntroDef[] = [
  { offerKey: 'malva-offer-wireless-5g', term: 12, months: 3, amountCents: { USD: 3500, EUR: 3200 } },
  { offerKey: 'malva-offer-cable-100', term: 24, months: 6, amountCents: { USD: 2999, EUR: 2799 } },
];

export const LEGACY_STEP_DEFS: StepDef[] = [
  { offerKey: 'malva-offer-phone-unlimited', term: 24, coversMonths: 24, steps: [{ fromMonth: 13, deltaCents: { USD: 500, EUR: 450 } }] },
];

export function setLegacyPricingDefs(): void {
  INTRO_DEFS.splice(0, INTRO_DEFS.length, ...LEGACY_INTRO_DEFS);
  STEP_DEFS.splice(0, STEP_DEFS.length, ...LEGACY_STEP_DEFS);
}

export function clearLegacyPricingDefs(): void {
  INTRO_DEFS.splice(0, INTRO_DEFS.length);
  STEP_DEFS.splice(0, STEP_DEFS.length);
}

/** Call at the top of a describe: installs the legacy definitions before each test and empties the lists afterwards. */
export function installLegacyPricingDefs(): void {
  beforeEach(setLegacyPricingDefs);
  afterEach(clearLegacyPricingDefs);
}
