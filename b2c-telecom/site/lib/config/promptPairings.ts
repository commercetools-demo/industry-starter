// Curated pairings of the discount prompt (D-027, Planner default): which offer to suggest when a cart is one offer away from a discount.
// The merchandiser changes this file and the matching Cart Discount in one pull request and reviews it monthly (v1 has no conversion
// analytics). Prompts only ever suggest ADDING a line, never changing an existing one.
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

/**
 * No pairing is active: the discounts that rewarded a second line or a bundle recurred on every order and were retired, because
 * promotions now apply to the first order only. With no reachable discount the prompt returns nothing (discount-activating-offer-prompt).
 */
export const PROMPT_PAIRINGS: PromptPairing[] = [];
