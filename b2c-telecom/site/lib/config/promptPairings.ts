// Curated pairings of the discount prompt (D-027, Planner default): which offer to suggest when a cart is one offer away from a discount.
// The merchandiser changes this file and the matching Cart Discount in one pull request and reviews it monthly (v1 has no conversion
// analytics). Prompts only ever suggest ADDING a line, never changing an existing one.
import { DISCOUNT_KEYS } from '@/lib/config/discounts';
import type { TermMonths } from '@/lib/types';

/** A small read-only view over the cart for the pairing rules. */
export interface PromptState {
  hasCategory: (categoryKey: string) => boolean;
  /** Total number of phone lines (quantity of the phone plan lines). */
  phoneLineCount: () => number;
  /** Offer key of the single phone plan in the cart, null when there is none or more than one. */
  phoneOfferKey: () => string | null;
  phoneTerm: () => TermMonths;
}

export type PromptGroup = 'consumer' | 'small-business' | 'employee' | 'existing-customer';

export interface PromptPairing {
  key: string;
  /** The Cart Discount the suggested line would activate (`includedDiscounts[].discount.key`). */
  discountKey: string;
  messageKey: string;
  /** Customer groups the discount is for; unset = everyone. */
  eligibleGroups?: PromptGroup[];
  when: (state: PromptState) => boolean;
  candidate: (state: PromptState) => { offerKey: string; termMonths: TermMonths; quantity: number } | null;
}

const HOME_INTERNET_CATEGORIES = ['malva-cat-cable-internet', 'malva-cat-home-wireless'];

export const PROMPT_PAIRINGS: PromptPairing[] = [
  {
    // G's `malva-cd-bundle-5`: a phone plan together with cable or wireless internet saves $5 a month on the internet plan.
    key: 'bundle-cable-phone',
    discountKey: DISCOUNT_KEYS.bundleCablePhone,
    messageKey: 'bundle.prompt.cablePhone',
    when: (state) => HOME_INTERNET_CATEGORIES.some((category) => state.hasCategory(category)) && !state.hasCategory('malva-cat-phone-plans'),
    candidate: () => ({ offerKey: 'malva-offer-phone-essential', termMonths: 0, quantity: 1 }),
  },
  {
    // `malva-cd-second-line-10`: lines 2 to 5 of a phone plan are $10 cheaper each.
    key: 'second-line',
    discountKey: DISCOUNT_KEYS.secondLine,
    messageKey: 'bundle.prompt.secondLine',
    when: (state) => state.phoneLineCount() === 1 && state.phoneOfferKey() !== null,
    candidate: (state) => {
      const offerKey = state.phoneOfferKey();
      return offerKey ? { offerKey, termMonths: state.phoneTerm(), quantity: 1 } : null;
    },
  },
];
