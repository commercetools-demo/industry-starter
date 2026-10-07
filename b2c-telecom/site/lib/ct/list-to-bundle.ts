import 'server-only';
import { BundleRefusal } from '@/lib/cart/errors';
import { getLocalizedString } from '@/lib/format';
import { sortForBundle } from '@/lib/lists/order';
import { lineKey, resolveLines } from '@/lib/lists/resolve';
import type { SessionData } from '@/lib/session-types';
import type { BundleMoveResult, Cart, Market, Offer } from '@/lib/types';
import { addToBundle, readBundle, type AddInput, type BundleOutcome } from './bundle';
import { getOffersByKeys } from './catalog';
import { readOwned } from './lists';

// "Add all to My bundle". The spec names the cart action `addShoppingList`; we do NOT use it: it copies lines blindly, bypassing the
// compatibility rules (J), exclusivity and eligibility (K) and the add-on parent link (D-026), and says nothing about a refused line.
// Instead every saved line goes through M's single-line add (`addToBundle`: the same guard as the offer cards), one at a time (cart
// version safety), and every refusal is reported with its reason. The list itself is never modified.

/** The one place that imports M's add function; tests pass their own. */
export type AddLine = (session: SessionData, market: Market, input: AddInput) => Promise<BundleOutcome>;

const NO_LONGER_AVAILABLE = { code: 'NO_LONGER_AVAILABLE', message: 'No longer available.' } as const;

type Reason = BundleMoveResult['skipped'][number]['reason'];

/** J/K refusals arrive as OFFER_BLOCKED with the reasons in `details`; the first reason's code, text key and params pass through. */
function reasonOf(refusal: BundleRefusal): Reason {
  const reasons = (refusal.details as { reasons?: Array<{ code?: unknown; messageKey?: unknown; params?: unknown }> } | undefined)?.reasons;
  const first = refusal.code === 'OFFER_BLOCKED' ? reasons?.[0] : undefined;
  if (first && typeof first.code === 'string') {
    return {
      code: first.code,
      message: refusal.message,
      ...(typeof first.messageKey === 'string' ? { messageKey: first.messageKey } : {}),
      ...(typeof first.params === 'object' && first.params !== null ? { params: first.params as Record<string, string | number> } : {}),
    };
  }
  return { code: refusal.code, message: refusal.message };
}

export interface MoveOutcome {
  result: BundleMoveResult;
  /** The cart id the session must hold afterwards (the move may have created the cart). */
  cartId: string | undefined;
}

/**
 * Moves the customer's saved list into their bundle: plans first, then handsets, then add-ons and equipment (so parents exist before
 * dependents). A line that is no longer sold, or that the rules refuse, is skipped with its reason; the rest is added. A failure that is
 * not a rule verdict aborts and rethrows, leaving the lines already added in the bundle.
 */
export async function moveListToBundle(session: SessionData & { customerId: string }, market: Market, listId: string, addLine: AddLine = addToBundle): Promise<MoveOutcome> {
  const list = await readOwned(session.customerId, listId); // a foreign list is ListNotFoundError before anything is read or written
  const refs = list.lineItems.map((line) => {
    const key = (line.custom?.fields as Record<string, unknown> | undefined)?.offerKey;
    return { line, offerKey: typeof key === 'string' ? key : '', variantId: line.variantId ?? 1 };
  });
  const offers: Offer[] = await getOffersByKeys([...new Set(refs.map((ref) => ref.offerKey).filter(Boolean))], market);
  const prices = resolveLines(refs.filter((ref) => ref.offerKey), offers, new Date());
  const offerByKey = new Map(offers.map((offer) => [offer.key, offer]));
  const ordered = sortForBundle(refs, (ref) => offerByKey.get(ref.offerKey)?.kind ?? 'equipment');

  const added: BundleMoveResult['added'] = [];
  const skipped: BundleMoveResult['skipped'] = [];
  let current: SessionData = session;
  let cart: Cart | null = null;
  let cartId = session.cartId;

  for (const ref of ordered) {
    const price = ref.offerKey ? prices.get(lineKey(ref.offerKey, ref.variantId)) : undefined;
    const name = price?.name || getLocalizedString(ref.line.name, market.locale);
    const variant = offerByKey.get(ref.offerKey)?.variants.find((entry) => entry.id === ref.variantId);
    if (!price?.available || !variant) {
      skipped.push({ lineId: ref.line.id, ...(ref.offerKey ? { offerKey: ref.offerKey } : {}), name, reason: NO_LONGER_AVAILABLE });
      continue;
    }
    try {
      const outcome = await addLine(current, market, { offerKey: ref.offerKey, sku: variant.sku, quantity: ref.line.quantity });
      cart = outcome.cart;
      cartId = outcome.cartId ?? cartId;
      current = { ...current, ...(outcome.cartId ? { cartId: outcome.cartId } : {}) };
      added.push({ lineId: ref.line.id, offerKey: ref.offerKey, name });
    } catch (error) {
      if (!(error instanceof BundleRefusal)) throw error;
      skipped.push({ lineId: ref.line.id, offerKey: ref.offerKey, name, reason: reasonOf(error) });
    }
  }

  if (!cart) {
    const read = await readBundle(current, market);
    cart = read.cart;
    cartId = read.cartId ?? cartId;
  }
  return { result: { added, skipped, cart }, cartId };
}
