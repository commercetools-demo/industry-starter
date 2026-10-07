import 'server-only';
import type { Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { BundleRefusal, blockedRefusal } from '@/lib/cart/errors';
import { guardAdd } from '@/lib/cart/guard';
import { checkQuantity } from '@/lib/cart/quantity';
import { availableModeNames, getAvailableModes, policyKeyFor, readAcquisition } from '@/lib/devices/acquisition';
import { assertDeviceCartIntegrity, buildAddDeviceActions, buildChangeModeActions, checkPriceFromPolicy } from '@/lib/devices/cart-actions';
import { mapDeviceOffer } from '@/lib/mappers/device';
import type { SessionData } from '@/lib/session-types';
import type { AcquisitionMode, DeviceOffer, DeviceVariant, Market, Offer } from '@/lib/types';
import { getAvailableQuantities } from './availability';
import { mapForMarket, type BundleOutcome } from './bundle';
import { createCartForSession, deleteCart, getActiveCartForSession, getCartById, offerKeyOfLine, toGuardLines, updateCart, withCartRetry } from './cart';
import { getAllOffers } from './catalog';
import { getBuyerContext } from './buyer-context';
import { getDevicePolicyMap } from './devices';

// Orchestration of the device lines of "My bundle" (workstream Q): the availability guard before the cart call, the resolution guard
// after it (the price must come from the policy of the mode and term, never from the one-time price), and one update per change.

export interface AddDeviceRequest {
  offerKey: string;
  sku: string;
  quantity: number;
  mode: AcquisitionMode;
  termMonths: number;
}

const MODE_LABEL: Record<AcquisitionMode, string> = { outright: 'pay in full', installments: 'installments', lease: 'lease' };
const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const outcome = (cart: BundleOutcome['cart']): BundleOutcome => ({ cart, cartId: cart?.id });

async function refuse(session: SessionData, market: Market, refusal: BundleRefusal): Promise<never> {
  try {
    const existing = await getActiveCartForSession(session, market);
    refusal.cart = existing ? (await mapForMarket(existing, market)).cart : null;
  } catch (error) {
    console.error(error);
  }
  throw refusal;
}

/** The term a mode is stored with: outright has none. */
const termOf = (mode: AcquisitionMode, termMonths: number): number => (mode === 'outright' ? 0 : termMonths);

/** The availability guard. Missing price for a market, mode or term means the mode or term is not offered for THIS variant. */
export function checkAvailability(device: DeviceOffer, variant: DeviceVariant, mode: AcquisitionMode, termMonths: number): BundleRefusal | null {
  const names = availableModeNames(variant.prices);
  if (!names.includes(mode)) {
    return new BundleRefusal(409, 'MODE_UNAVAILABLE', `${sentence(MODE_LABEL[mode])} is not available for ${device.name}. Available: ${names.map((name) => MODE_LABEL[name]).join(', ')}.`, { offerKey: device.key, mode, available: names });
  }
  const available = getAvailableModes(variant.prices);
  const terms: number[] = mode === 'installments' ? available.installments : mode === 'lease' ? available.lease : [];
  if (mode !== 'outright' && !terms.includes(termMonths)) {
    return new BundleRefusal(409, 'TERM_UNAVAILABLE', `The ${termMonths}-month term is not available for this ${mode === 'lease' ? 'lease' : 'device'}.`, { offerKey: device.key, mode, termMonths, availableTerms: terms });
  }
  return null;
}

interface Loaded {
  offer: Offer;
  device: DeviceOffer;
  variant: DeviceVariant;
  offersByKey: Record<string, Offer>;
  policyIdByKey: Record<string, string>;
}

async function load(session: SessionData, market: Market, offerKey: string, sku: string): Promise<Loaded> {
  const [offers, policyKeyById] = await Promise.all([getAllOffers(market), getDevicePolicyMap()]);
  const offersByKey = Object.fromEntries(offers.map((offer) => [offer.key, offer]));
  const offer = offersByKey[offerKey];
  const device = offer ? mapDeviceOffer(offer, policyKeyById) : null;
  if (!offer || !device) return refuse(session, market, new BundleRefusal(404, 'OFFER_NOT_FOUND', 'Offer not found.'));
  const variant = device.variants.find((entry) => entry.sku === sku);
  if (!variant) return refuse(session, market, new BundleRefusal(404, 'UNKNOWN_SKU', 'Variant not found.'));
  const policyIdByKey = Object.fromEntries(Object.entries(policyKeyById).map(([id, key]) => [key, id]));
  return { offer, device, variant, offersByKey, policyIdByKey };
}

const fieldsOf = (line: LineItem): Record<string, unknown> | undefined => line.custom?.fields as Record<string, unknown> | undefined;
const sameAcquisition = (line: LineItem, sku: string, mode: AcquisitionMode, termMonths: number): boolean => {
  const found = readAcquisition(fieldsOf(line));
  return line.variant.sku === sku && found !== null && found.mode === mode && found.termMonths === termOf(mode, termMonths);
};

/**
 * The resolution guard: the line the update produced must price from the policy of its mode and term. On a failure the line is
 * removed again in a second update and the answer is 422 PRICE_NOT_FOR_TERM (the platform never complains about the fallback).
 */
async function assertResolved(cart: CtCart, lineId: string, expectedPolicyId: string | null, market: Market, session: SessionData, rollback: () => Promise<CtCart>): Promise<void> {
  const line = cart.lineItems.find((entry) => entry.id === lineId);
  const result = line ? checkPriceFromPolicy(line, expectedPolicyId) : 'price-has-no-policy';
  if (result === 'ok') return;
  console.error(`[catalog-gap] device line price not from its policy line=${lineId} check=${result}`);
  await rollback();
  return refuse(session, market, new BundleRefusal(422, 'PRICE_NOT_FOR_TERM', 'This device has no price for that term, so it was not added.', { check: result }));
}

function quantityRefusal(offer: Offer, quantity: number): BundleRefusal | null {
  const limit = checkQuantity(offer, quantity);
  return limit ? blockedRefusal(limit) : null;
}

/** Adds one device line in a mode and term. The server runs every guard; the card's earlier picture is never trusted. */
export async function addDeviceToBundle(session: SessionData, market: Market, input: AddDeviceRequest): Promise<BundleOutcome> {
  const { offer, device, variant, offersByKey, policyIdByKey } = await load(session, market, input.offerKey, input.sku);
  const termMonths = termOf(input.mode, input.termMonths);

  const unavailable = checkAvailability(device, variant, input.mode, termMonths);
  if (unavailable) return refuse(session, market, unavailable);

  const existing = await getActiveCartForSession(session, market);
  const lines = existing ? toGuardLines(existing) : [];
  const sameLine = existing?.lineItems.find((line) => sameAcquisition(line, input.sku, input.mode, termMonths));
  const tooMany = quantityRefusal(offer, (sameLine?.quantity ?? 0) + input.quantity);
  if (tooMany) return refuse(session, market, tooMany);

  const buyer = await getBuyerContext(market);
  const guard = guardAdd({ candidate: offer, sku: input.sku, quantity: input.quantity, parentLineId: undefined, lines, offersByKey, buyer });
  if (!guard.allowed) return refuse(session, market, blockedRefusal(guard.blocked));

  const inCart = lines.filter((line) => line.sku === input.sku).reduce((sum, line) => sum + line.quantity, 0);
  const available = (await getAvailableQuantities([input.sku]))[input.sku] ?? 0;
  if (available < inCart + input.quantity) return refuse(session, market, new BundleRefusal(409, 'INSUFFICIENT_STOCK', 'Not enough stock.', { available, offerKey: offer.key }));

  const expectedPolicyId = policyKeyFor(input.mode, termMonths) === null ? null : (policyIdByKey[policyKeyFor(input.mode, termMonths) ?? ''] ?? null);
  if (input.mode !== 'outright' && expectedPolicyId === null) return refuse(session, market, new BundleRefusal(409, 'MODE_UNAVAILABLE', 'This payment option is not set up.', { offerKey: offer.key, mode: input.mode }));

  const cart = existing ?? (await createCartForSession(session, market));
  const updated = await withCartRetry(cart.id, async (fresh) => {
    const known = new Set(fresh.lineItems.map((line) => line.id));
    const next = await updateCart(fresh, buildAddDeviceActions({ sku: input.sku, offerKey: offer.key, quantity: input.quantity, mode: input.mode, termMonths }));
    const target = next.lineItems.find((line) => sameAcquisition(line, input.sku, input.mode, termMonths));
    if (target) {
      await assertResolved(next, target.id, expectedPolicyId, market, session, async () => (known.has(target.id) ? next : updateCart(next, [{ action: 'removeLineItem', lineItemId: target.id }])));
    }
    return next;
  }).catch(async (error: unknown) => {
    // A refusal answers an error, which never writes the session: a cart created only for this add would be lost, so take it away again.
    if (!existing && error instanceof BundleRefusal) await deleteCart(await getCartById(cart.id).then((fresh) => fresh ?? cart)).catch(() => undefined);
    throw error;
  });
  const mapped = await mapForMarket(updated, market);
  return { ...outcome(mapped.cart), ...(updated.anonymousId ? { anonymousId: updated.anonymousId } : {}) };
}

/**
 * Changes the mode and term of a device line: the old line is removed and the same sku and quantity added in the new mode, in ONE
 * update, so the price is resolved from scratch. A resolution failure puts the old mode back (a second update) and answers 422.
 */
export async function changeDeviceMode(session: SessionData, market: Market, lineId: string, next: { mode: AcquisitionMode; termMonths: number }): Promise<BundleOutcome> {
  const existing = await getActiveCartForSession(session, market);
  const line = existing?.lineItems.find((entry) => entry.id === lineId);
  if (!existing || !line) return refuse(session, market, new BundleRefusal(404, 'LINE_NOT_FOUND', 'That line is not in your bundle.'));
  const current = readAcquisition(fieldsOf(line));
  if (!current) return refuse(session, market, new BundleRefusal(400, 'NOT_A_DEVICE_LINE', 'That line is not a device.'));
  const sku = line.variant.sku ?? '';
  const offerKey = offerKeyOfLine(line);
  const termMonths = termOf(next.mode, next.termMonths);
  if (current.mode === next.mode && current.termMonths === termMonths) return outcome((await mapForMarket(existing, market)).cart);

  const { offer, device, variant, policyIdByKey } = await load(session, market, offerKey, sku);
  const unavailable = checkAvailability(device, variant, next.mode, termMonths);
  if (unavailable) return refuse(session, market, unavailable);
  const merged = existing.lineItems.find((entry) => entry.id !== lineId && sameAcquisition(entry, sku, next.mode, termMonths));
  const tooMany = quantityRefusal(offer, line.quantity + (merged?.quantity ?? 0));
  if (tooMany) return refuse(session, market, tooMany);
  const key = policyKeyFor(next.mode, termMonths);
  const expectedPolicyId = key === null ? null : (policyIdByKey[key] ?? null);
  if (key !== null && expectedPolicyId === null) return refuse(session, market, new BundleRefusal(409, 'MODE_UNAVAILABLE', 'This payment option is not set up.', { offerKey, mode: next.mode }));

  const addedAt = (line as LineItem & { addedAt?: string }).addedAt;
  const updated = await withCartRetry(existing.id, async (fresh) => {
    const old = fresh.lineItems.find((entry) => entry.id === lineId);
    if (!old) throw new BundleRefusal(404, 'LINE_NOT_FOUND', 'That line is not in your bundle.');
    const after = await updateCart(fresh, buildChangeModeActions({ lineItemId: lineId, sku, offerKey, quantity: old.quantity, ...(addedAt ? { addedAt } : {}) }, { mode: next.mode, termMonths }));
    const target = after.lineItems.find((entry) => sameAcquisition(entry, sku, next.mode, termMonths));
    if (target) {
      await assertResolved(after, target.id, expectedPolicyId, market, session, () =>
        updateCart(after, buildChangeModeActions({ lineItemId: target.id, sku, offerKey, quantity: old.quantity, ...(addedAt ? { addedAt } : {}) }, { mode: current.mode, termMonths: current.termMonths })),
      );
    }
    return after;
  });
  return outcome((await mapForMarket(updated, market)).cart);
}

/** Re-checks every device line of a cart against the policy of its recorded mode (U calls this before it creates a checkout session). */
export async function assertDeviceLinesPriced(cart: CtCart): Promise<void> {
  const policyKeyById = await getDevicePolicyMap();
  assertDeviceCartIntegrity(cart.lineItems, Object.fromEntries(Object.entries(policyKeyById).map(([id, key]) => [key, id])));
}
