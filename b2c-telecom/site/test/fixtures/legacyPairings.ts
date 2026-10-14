/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The shipped prompt pairing list is empty (promotions apply to the first order only). Tests of the prompt engine and its route install
// the two pairings that used to be shipped, so the engine keeps its coverage.
import { PROMPT_PAIRINGS, type PromptPairing } from '@/lib/config/promptPairings';

const HOME_INTERNET_CATEGORIES = ['malva-cat-cable-internet', 'malva-cat-home-wireless'];

export const LEGACY_PROMPT_PAIRINGS: PromptPairing[] = [
  {
    key: 'bundle-cable-phone',
    discountKey: 'malva-cd-bundle-5',
    messageKey: 'bundle.prompt.cablePhone',
    when: (state) => HOME_INTERNET_CATEGORIES.some((category) => state.hasCategory(category)) && !state.hasCategory('malva-cat-phone-plans'),
    candidate: () => ({ offerKey: 'malva-offer-phone-essential', termMonths: 0, quantity: 1 }),
  },
  {
    key: 'second-line',
    discountKey: 'malva-cd-second-line-10',
    messageKey: 'bundle.prompt.secondLine',
    when: (state) => state.phoneLineCount() === 1 && state.phoneOfferKey() !== null,
    candidate: (state) => {
      const offerKey = state.phoneOfferKey();
      return offerKey ? { offerKey, termMonths: state.phoneTerm(), quantity: 1 } : null;
    },
  },
];

/** Call at the top of a describe: installs the legacy pairings before each test and empties the list afterwards. */
export function installLegacyPairings(): void {
  beforeEach(() => {
    PROMPT_PAIRINGS.splice(0, PROMPT_PAIRINGS.length, ...LEGACY_PROMPT_PAIRINGS);
  });
  afterEach(() => {
    PROMPT_PAIRINGS.splice(0, PROMPT_PAIRINGS.length);
  });
}
