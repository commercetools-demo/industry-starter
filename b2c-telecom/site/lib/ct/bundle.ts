import 'server-only';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { blockedRefusal, BundleRefusal, refusalFromApiError } from '@/lib/cart/errors';
import { guardAdd, revalidateLines } from '@/lib/cart/guard';
import { precheckPlan } from '@/lib/cart/precheck';
import { checkQuantity } from '@/lib/cart/quantity';
import { codeStateInfo, mapCart } from '@/lib/mappers/cart';
import { removalPlan } from '@/lib/offers/addons';
import { toDateOnly } from '@/lib/pricing/dates';
import { getPrompts } from '@/lib/ct/prompts';
import type { SessionData } from '@/lib/session-types';
import type { BlockedAdd, Cart, DiscountCodeReason, DiscountPrompt, Market, Offer, OfferVariant, ServiceLocation } from '@/lib/types';
import { getAvailableQuantities } from './availability';
import { getBuyerContext } from './buyer-context';
import {
  addOfferLine,
  changeLineQuantity,
  createCartForSession,
  errorCodeOf,
  getActiveCartForSession,
  normalizeCart,
  offerKeyOfLine,
  removeLine,
  statusOf,
  toGuardLines,
  updateCart,
  withCartRetry,
} from './cart';
import { getAllOffers } from './catalog';
import { getCartDiscountKeys } from './discount-keys';
import { getServiceability } from './serviceability';

// Orchestration of "My bundle": every function takes the session and the market, checks ownership through the cart helpers (D-070),
// applies the guard on every add (the card's earlier verdict is never trusted) and answers with the full mapped cart read back from
// commercetools. Routes stay thin: they parse, call one function here, write the session and answer.

export interface BundleOutcome {
  /** The full cart as mapped from the server's answer (null when there is none). */
  cart: Cart | null;
  /** The id the session cookie must hold afterwards (undefined = clear it). */
  cartId: string | undefined;
  /** Set when a cart was created for an anonymous visitor: the session must remember it. */
  anonymousId?: string;
  /** Set by the address route: the route also remembers the ZIP in the HttpOnly cookie K reads. */
  postalCode?: string;
}

const PHYSICAL: ReadonlySet<Offer['kind']> = new Set(['equipment', 'device']);

async function offersByKeyFor(market: Market): Promise<Record<string, Offer>> {
  return Object.fromEntries((await getAllOffers(market)).map((offer) => [offer.key, offer]));
}

/**
 * Normalizes, revalidates (J + K), checks stock and maps. The second value is the cart after normalizing. `location` overrides the
 * remembered ZIP of the buyer (the address route has just changed it, the cookie is not on the request yet).
 */
export async function mapForMarket(ct: CtCart, market: Market, location?: ServiceLocation): Promise<{ cart: Cart; ct: CtCart }> {
  const [offersByKey, baseBuyer, discountKeyById] = await Promise.all([offersByKeyFor(market), getBuyerContext(market), getCartDiscountKeys()]);
  const buyer = location ? { ...baseBuyer, location } : baseBuyer;
  const normalized = await normalizeCart(ct, offersByKey);
  const issues = revalidateLines({ lines: toGuardLines(normalized), offersByKey, buyer });
  const physical = normalized.lineItems.flatMap((line) => {
    const kind = offersByKey[offerKeyOfLine(line)]?.kind;
    return kind && PHYSICAL.has(kind) && line.variant.sku ? [line.variant.sku] : [];
  });
  const stock = physical.length > 0 ? await getAvailableQuantities(physical) : {};
  const cart = mapCart(normalized, market, { offersByKey, stock, issues, today: toDateOnly(new Date()), discountKeyById });
  return { cart, ct: normalized };
}

const outcome = (cart: Cart): BundleOutcome => ({ cart, cartId: cart.id });

/** The session's cart, mapped. A stale, foreign or other-market cart reads as no cart and `cartId` is undefined (the route clears it). */
export async function readBundle(session: SessionData, market: Market): Promise<BundleOutcome> {
  const ct = await getActiveCartForSession(session, market);
  if (!ct) return { cart: null, cartId: undefined };
  return outcome((await mapForMarket(ct, market)).cart);
}

async function currentCart(session: SessionData, market: Market): Promise<Cart | null> {
  return (await readBundle(session, market)).cart;
}

async function refuse(session: SessionData, market: Market, refusal: BundleRefusal): Promise<never> {
  try {
    refusal.cart = await currentCart(session, market);
  } catch (error) {
    console.error(error);
  }
  throw refusal;
}

export interface AddInput {
  offerKey: string;
  sku: string;
  quantity: number;
  parentLineId?: string | undefined;
  replaceLineId?: string | undefined;
}

function stockRefusal(offer: Offer, available: number): BundleRefusal {
  return new BundleRefusal(409, 'INSUFFICIENT_STOCK', 'Not enough stock.', { available, offerKey: offer.key });
}

/**
 * Adds an offer. Order: unknown offer/sku (404) -> the guard (M rules, K eligibility, K exclusivity, J compatibility) -> plan checks
 * (price schedule and label data, nothing is written when they fail) -> stock of equipment and devices (409) -> write. `replaceLineId`
 * removes that line and its dependents first and re-runs the guard against what remains, so a conflict is resolved by the buyer, never
 * automatically.
 */
export async function addToBundle(session: SessionData, market: Market, input: AddInput): Promise<BundleOutcome> {
  const offersByKey = await offersByKeyFor(market);
  const candidate = offersByKey[input.offerKey];
  if (!candidate) throw new BundleRefusal(404, 'UNKNOWN_OFFER', 'Offer not found.');
  const variant: OfferVariant | undefined = candidate.variants.find((entry) => entry.sku === input.sku);
  if (!variant) throw new BundleRefusal(404, 'UNKNOWN_SKU', 'Variant not found.');

  const existing = await getActiveCartForSession(session, market);
  const allLines = existing ? toGuardLines(existing) : [];
  let lines = allLines;
  let removeLineId: string | undefined;
  if (input.replaceLineId) {
    if (!allLines.some((line) => line.lineItemId === input.replaceLineId)) await refuse(session, market, new BundleRefusal(404, 'LINE_NOT_FOUND', 'That line is not in your bundle.'));
    removeLineId = input.replaceLineId;
    const gone = new Set(removalPlan(allLines, input.replaceLineId).removeIds);
    lines = allLines.filter((line) => !gone.has(line.lineItemId));
  }

  const buyer = await getBuyerContext(market);
  const guard = guardAdd({ candidate, sku: input.sku, quantity: input.quantity, parentLineId: input.parentLineId, lines, offersByKey, buyer });
  if (!guard.allowed) {
    const blocked: BlockedAdd = guard.blocked;
    return refuse(session, market, blockedRefusal(blocked, guard.candidateParents ? { candidateParents: guard.candidateParents } : {}));
  }

  if (candidate.kind === 'base-package' || candidate.kind === 'bundle') {
    const pre = precheckPlan({ offer: candidate, variant, quantity: input.quantity, today: toDateOnly(new Date()) });
    if (!pre.ok) {
      if (pre.reason === 'LABEL_DATA_MISSING') console.error(`[catalog-gap] offer=${candidate.key} sku=${variant.sku} missing=${(pre.missing ?? []).join(',')}`);
      else console.error(`[catalog-gap] offer=${candidate.key} sku=${variant.sku} reason=${pre.reason.toLowerCase()}`);
      const message = pre.reason === 'LABEL_DATA_MISSING' ? 'This plan is temporarily unavailable.' : 'This plan cannot be priced for its full term yet.';
      return refuse(session, market, new BundleRefusal(422, pre.reason, message, { offerKey: candidate.key, ...(pre.missing ? { missing: pre.missing } : {}), ...(pre.detail ? { detail: pre.detail } : {}) }));
    }
  }

  const equipment = guard.equipment.flatMap((selection) => {
    const offer = offersByKey[selection.offerKey];
    const selected = offer?.variants.find((entry) => entry.sku === selection.variantSku);
    return offer && selected ? [{ offer, variant: selected }] : [];
  });

  const physicalSkus = [...(PHYSICAL.has(candidate.kind) ? [variant.sku] : []), ...equipment.map((entry) => entry.variant.sku)];
  if (physicalSkus.length > 0) {
    const available = await getAvailableQuantities(physicalSkus);
    const inCart = lines.filter((line) => line.sku === variant.sku).reduce((sum, line) => sum + line.quantity, 0);
    if (PHYSICAL.has(candidate.kind) && (available[variant.sku] ?? 0) < inCart + input.quantity) {
      return refuse(session, market, stockRefusal(candidate, available[variant.sku] ?? 0));
    }
    for (const entry of equipment) {
      if ((available[entry.variant.sku] ?? 0) < 1) return refuse(session, market, stockRefusal(entry.offer, available[entry.variant.sku] ?? 0));
    }
  }

  try {
    let ct = existing ?? (await createCartForSession(session, market));
    if (removeLineId) ct = await removeLine(ct.id, removeLineId, { cascade: true, locale: market.locale });
    const updated = await addOfferLine(ct.id, { offer: candidate, variant, quantity: input.quantity, parentLineId: guard.parentLineId, equipment });
    const mapped = await mapForMarket(updated, market);
    return { ...outcome(mapped.cart), ...(updated.anonymousId ? { anonymousId: updated.anonymousId } : {}) };
  } catch (error) {
    const mapped = refusalFromApiError(error);
    if (mapped) return refuse(session, market, mapped);
    throw error;
  }
}

/** Sets a phone plan's number of lines (or another line's quantity within its rule). Dependents and the fee follow on the server. */
export async function setLineQuantity(session: SessionData, market: Market, lineId: string, quantity: number): Promise<BundleOutcome> {
  const existing = await getActiveCartForSession(session, market);
  const line = existing?.lineItems.find((entry) => entry.id === lineId);
  if (!existing || !line) return refuse(session, market, new BundleRefusal(404, 'LINE_NOT_FOUND', 'That line is not in your bundle.'));
  const offersByKey = await offersByKeyFor(market);
  const offer = offersByKey[offerKeyOfLine(line)];
  if (offer) {
    const limit = checkQuantity(offer, quantity);
    if (limit) return refuse(session, market, blockedRefusal(limit));
    if (PHYSICAL.has(offer.kind) && line.variant.sku) {
      const available = (await getAvailableQuantities([line.variant.sku]))[line.variant.sku] ?? 0;
      if (available < quantity) return refuse(session, market, stockRefusal(offer, available));
    }
  }
  try {
    const updated = await changeLineQuantity(existing.id, lineId, quantity);
    return outcome((await mapForMarket(updated, market)).cart);
  } catch (error) {
    const mapped = refusalFromApiError(error);
    if (mapped) return refuse(session, market, mapped);
    throw error;
  }
}

/** Removes a line. With dependents and no `cascade` it answers HAS_DEPENDENTS (409) naming them: the buyer confirms first (D-026). */
export async function removeFromBundle(session: SessionData, market: Market, lineId: string, cascade: boolean): Promise<BundleOutcome> {
  const existing = await getActiveCartForSession(session, market);
  if (!existing || !existing.lineItems.some((entry) => entry.id === lineId)) return refuse(session, market, new BundleRefusal(404, 'LINE_NOT_FOUND', 'That line is not in your bundle.'));
  try {
    const updated = await removeLine(existing.id, lineId, { cascade, locale: market.locale });
    return outcome((await mapForMarket(updated, market)).cart);
  } catch (error) {
    const mapped = refusalFromApiError(error);
    if (mapped) return refuse(session, market, mapped);
    throw error;
  }
}

/**
 * Remembers where the bundle will be served (cart custom field `postalCode`, the serviceability flags and the shipping address) and
 * answers with K's issues for the new location. Without a cart nothing is written and the answer has no cart.
 */
export async function setBundleAddress(session: SessionData, market: Market, input: { postalCode: string }): Promise<BundleOutcome> {
  const existing = await getActiveCartForSession(session, market);
  if (!existing) return { cart: null, cartId: undefined, postalCode: input.postalCode };
  const location = await getServiceability().check(input.postalCode, market.country);
  const updated = await withCartRetry(existing.id, (fresh) =>
    updateCart(fresh, [
      { action: 'setCustomField', name: 'postalCode', value: input.postalCode },
      { action: 'setCustomField', name: 'serviceableCable', value: location.served.cable },
      { action: 'setCustomField', name: 'serviceableWireless', value: location.served['fixed-wireless'] },
      { action: 'setCustomField', name: 'serviceablePhone', value: location.served.mobile },
      { action: 'setShippingAddress', address: { country: market.country, postalCode: input.postalCode } },
    ]),
  );
  return { ...outcome((await mapForMarket(updated, market, location)).cart), postalCode: input.postalCode };
}

const REJECTION_CODES = new Set(['ResourceNotFound', 'InvalidOperation', 'DiscountCodeNonApplicable']);

function rejection(code: string, reason: DiscountCodeReason): BundleRefusal {
  return new BundleRefusal(422, 'DISCOUNT_CODE_REJECTED', 'That code could not be applied.', { reason, code });
}

/**
 * Applies a discount code. A code that does not match the cart is taken off again in a second update and the answer is 422
 * DISCOUNT_CODE_REJECTED with the reason and the unchanged cart: a refused code never stays on the cart.
 */
export async function applyDiscountCode(session: SessionData, market: Market, rawCode: string): Promise<BundleOutcome> {
  const code = rawCode.trim();
  const existing = await getActiveCartForSession(session, market);
  if (!existing) return refuse(session, market, rejection(code, 'not-applicable'));
  let added: CtCart;
  try {
    added = await withCartRetry(existing.id, (fresh) => updateCart(fresh, [{ action: 'addDiscountCode', code }]));
  } catch (error) {
    if ((statusOf(error) === 400 || statusOf(error) === 404) && REJECTION_CODES.has(errorCodeOf(error) ?? '')) return refuse(session, market, rejection(code, 'unknown-code'));
    throw error;
  }
  const info = added.discountCodes.find((entry) => entry.discountCode.obj?.code?.toLowerCase() === code.toLowerCase());
  const state = info?.state ?? 'DoesNotMatchCart';
  if (state === 'MatchesCart') return outcome((await mapForMarket(added, market)).cart);
  const cleaned = info
    ? await withCartRetry(added.id, (fresh) => updateCart(fresh, [{ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: info.discountCode.id } }]))
    : added;
  const refusal = rejection(code, codeStateInfo(state).reason ?? 'not-applicable');
  refusal.cart = (await mapForMarket(cleaned, market)).cart;
  throw refusal;
}

/** Takes a code off the cart (also one that no longer applies). 404 when the cart does not carry it. */
export async function removeDiscountCode(session: SessionData, market: Market, rawCode: string): Promise<BundleOutcome> {
  const code = rawCode.trim().toLowerCase();
  const existing = await getActiveCartForSession(session, market);
  const info = existing?.discountCodes.find((entry) => entry.discountCode.obj?.code?.toLowerCase() === code);
  if (!existing || !info) return refuse(session, market, new BundleRefusal(404, 'CODE_NOT_FOUND', 'That code is not on your bundle.'));
  const updated = await withCartRetry(existing.id, (fresh) =>
    updateCart(fresh, [{ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: info.discountCode.id } }]),
  );
  return outcome((await mapForMarket(updated, market)).cart);
}

/** The discount prompts of the session's cart (never cached: priced from a prospective cart on every call). */
export async function getBundlePrompts(session: SessionData, market: Market): Promise<DiscountPrompt[]> {
  const ct = await getActiveCartForSession(session, market);
  if (!ct || ct.lineItems.length === 0) return [];
  const [offersByKey, buyer, discountKeyById] = await Promise.all([offersByKeyFor(market), getBuyerContext(market), getCartDiscountKeys()]);
  return getPrompts({ ct, market, offersByKey, buyer, discountKeyById });
}
