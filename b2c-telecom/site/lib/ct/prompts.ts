import 'server-only';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { guardAdd } from '@/lib/cart/guard';
import { PROBE_CART_KEY_PREFIX, PROMPT_MAX_CANDIDATES } from '@/lib/config/cart';
import { PROMPT_PAIRINGS, type PromptPairing, type PromptState } from '@/lib/config/promptPairings';
import { buildProbeDraft } from './cartDrafts';
import { createProbeCart, deleteCart, offerKeyOfLine, toGuardLines } from './cart';
import { formatMoneyExact } from '@/lib/format';
import type { BuyerContext, DiscountPrompt, Market, Offer, TermMonths } from '@/lib/types';

// Discount-activating offer prompt (spec discount-activating-offer-prompt, D-027). Never cached: every call re-prices.

const isPlan = (offer: Offer | undefined): offer is Offer => offer !== undefined && (offer.kind === 'base-package' || offer.kind === 'bundle');

/**
 * What the engine granted from one Cart Discount, per month: the sum over the MONTHLY lines of `discountedAmount x quantity` of every
 * included discount whose key matches. Read from a priced cart, so best-deal selection and stop-after-this-discount are already in it.
 */
export function attributable(cart: CtCart, discountKey: string, discountKeyById: Record<string, string>): number {
  let cents = 0;
  for (const line of cart.lineItems) {
    if (!line.recurrenceInfo) continue;
    for (const portion of line.discountedPricePerQuantity ?? []) {
      for (const included of portion.discountedPrice.includedDiscounts) {
        if (discountKeyById[included.discount.id] === discountKey) cents += included.discountedAmount.centAmount * portion.quantity;
      }
    }
  }
  return cents;
}

/** A read-only view over the cart for the pairing rules. */
export function promptState(cart: CtCart, offersByKey: Record<string, Offer>): PromptState & { phoneSku: () => string | null } {
  const lines = cart.lineItems.flatMap((line) => {
    const offer = offersByKey[offerKeyOfLine(line)];
    return offer ? [{ line, offer }] : [];
  });
  const phone = lines.filter(({ offer }) => isPlan(offer) && offer.facts?.kind === 'plan' && offer.facts.family === 'phone');
  const single = phone.length === 1 ? phone[0] : undefined;
  return {
    hasCategory: (categoryKey) => lines.some(({ offer }) => offer.categoryKeys.includes(categoryKey)),
    phoneLineCount: () => phone.reduce((sum, { line }) => sum + line.quantity, 0),
    phoneOfferKey: () => single?.offer.key ?? null,
    phoneTerm: () => (single?.offer.variants.find((variant) => variant.sku === single.line.variant.sku)?.termMonths ?? 0) as TermMonths,
    phoneSku: () => single?.line.variant.sku ?? null,
  };
}

function eligibleFor(pairing: PromptPairing, buyer: BuyerContext): boolean {
  const groups = pairing.eligibleGroups;
  if (!groups) return true;
  return groups.includes(buyer.customerType) || (groups.includes('existing-customer') && buyer.isExistingCustomer);
}

export interface PromptInput {
  ct: CtCart;
  market: Market;
  offersByKey: Record<string, Offer>;
  buyer: BuyerContext;
  discountKeyById: Record<string, string>;
}

/**
 * For each curated pairing (at most PROMPT_MAX_CANDIDATES, in config order): skip when the pairing does not apply, when its discount
 * already applies, when the buyer is not eligible or the guard would refuse the candidate (prompts only ADD a line, never replace);
 * otherwise price a prospective cart and quote the saving it shows. A saving of 0 or less (the discount is suppressed by another one)
 * is not suggested. The probe cart is always deleted.
 */
export async function getPrompts(input: PromptInput): Promise<DiscountPrompt[]> {
  const { ct, market, offersByKey, buyer, discountKeyById } = input;
  const state = promptState(ct, offersByKey);
  const lines = toGuardLines(ct);
  const current = (key: string): number => attributable(ct, key, discountKeyById);
  const prompts: DiscountPrompt[] = [];

  for (const pairing of PROMPT_PAIRINGS.slice(0, PROMPT_MAX_CANDIDATES)) {
    if (!pairing.when(state)) continue; // No reachable discount: nothing is suggested
    if (current(pairing.discountKey) > 0) continue; // Satisfied discount not repeated
    if (!eligibleFor(pairing, buyer)) continue; // Ineligible offer never suggested
    const picked = pairing.candidate(state);
    const offer = picked ? offersByKey[picked.offerKey] : undefined;
    const variant = offer?.variants.find((entry) => entry.termMonths === picked?.termMonths && entry.recurringPrice !== undefined);
    if (!picked || !offer || !variant) continue;
    const guard = guardAdd({ candidate: offer, sku: variant.sku, quantity: picked.quantity, lines, offersByKey, buyer });
    if (!guard.allowed) continue;

    let probe: CtCart | undefined;
    try {
      const key = `${PROBE_CART_KEY_PREFIX}${crypto.randomUUID()}`;
      probe = await createProbeCart(buildProbeDraft(ct, market, { offer, variant, quantity: picked.quantity, parentLineId: guard.parentLineId }, key));
      const saving = attributable(probe, pairing.discountKey, discountKeyById) - current(pairing.discountKey);
      if (saving <= 0) continue;
      const money = { centAmount: saving, currencyCode: market.currency };
      prompts.push({
        pairingKey: pairing.key,
        discountKey: pairing.discountKey,
        candidate: { offerKey: offer.key, sku: variant.sku, name: offer.name, quantity: picked.quantity, termMonths: picked.termMonths },
        saving: money,
        messageKey: pairing.messageKey,
        params: { name: offer.name, saving: formatMoneyExact(money, market.locale) },
      });
    } catch (error) {
      console.error('[prompts] could not price', pairing.key, error);
    } finally {
      if (probe) await deleteCart(probe).catch((error: unknown) => console.error('[prompts] probe cart not deleted (it expires on its own)', probe?.id, error));
    }
  }
  return prompts;
}
