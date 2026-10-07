import 'server-only';
import type { Cart as CtCart, CartDraft, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api-error';
import { ACTIVATION_FEE_SLUG_PREFIX, CART_DELETE_DAYS, MAX_PHONE_LINES } from '@/lib/config/cart';
import { getLocalizedString } from '@/lib/format';
import { dependentQuantity } from '@/lib/offers/addons';
import type { SessionData } from '@/lib/session-types';
import type { Market, Offer, OfferVariant } from '@/lib/types';
import { activationFeeOf, addFeeAction, addLineItemAction, feeSlug, isRecurringVariant } from './cartDrafts';
import { getApiRoot } from './client';
import { ensureAnonymousId } from './identity';
import { assertRecurringPrice, getMonthlyPolicy, RECURRING_REASON } from './recurring';
import { withTimeout } from './timeout';

// Cart reads and writes of "My bundle" (workstream M). Every helper takes the session and checks ownership (D-070): a cart id from a
// cookie or body is never trusted on its own. Carts are typed `malva-order` from creation (G/L finding: the type cannot change at order time).

export type CartCtx = Market;

/** Expansion every cart read uses: the code text of applied discount codes. */
export const CART_EXPAND = ['discountCodes[*].discountCode'];

/** Detail `reason` of the ApiError thrown after a second ConcurrentModification. */
export const CART_CONFLICT_REASON = 'CART_CONFLICT';

export function statusOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const e = err as { statusCode?: unknown; code?: unknown };
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (typeof e.code === 'number') return e.code;
  }
  return undefined;
}

export function errorCodeOf(err: unknown): string | undefined {
  const body = (err as { body?: { errors?: { code?: unknown }[] } } | null)?.body;
  const code = body?.errors?.[0]?.code;
  return typeof code === 'string' ? code : undefined;
}

/** `null` for an unknown cart and for one that is not Active (ordered, merged, deleted). */
export async function getCartById(id: string): Promise<CtCart | null> {
  try {
    const { body } = await withTimeout(getApiRoot().carts().withId({ ID: id }).get({ queryArgs: { expand: CART_EXPAND } }).execute(), 'cart.get');
    return body.cartState === 'Active' ? body : null;
  } catch (err) {
    if (statusOf(err) === 404) return null;
    throw err;
  }
}

/** The cart belongs to this session (signed-in customer, or the anonymous id that created it). */
export function ownsCart(cart: CtCart, session: SessionData): boolean {
  if (cart.customerId) return cart.customerId === session.customerId;
  return cart.anonymousId !== undefined && cart.anonymousId === session.anonymousId;
}

/** A cart cannot change currency: a cart of another market is ignored, never converted. */
export function matchesMarket(cart: CtCart, ctx: CartCtx): boolean {
  return cart.totalPrice.currencyCode === ctx.currency && (cart.country === undefined || cart.country === ctx.country);
}

/**
 * The session's active cart for this market, or null (no cart yet, stale id, someone else's cart, other currency). A signed-in
 * session without a cart id gets its most recently modified customer cart (not a probe or recurring cart: those have another origin).
 */
export async function getActiveCartForSession(session: SessionData, ctx: CartCtx): Promise<CtCart | null> {
  if (session.cartId) {
    const cart = await getCartById(session.cartId);
    if (cart && ownsCart(cart, session) && matchesMarket(cart, ctx)) return cart;
    if (!session.customerId) return null;
  }
  if (!session.customerId) return null;
  const { body } = await withTimeout(
    getApiRoot()
      .carts()
      .get({
        queryArgs: {
          where: `customerId="${session.customerId}" and cartState="Active" and origin="Customer"`,
          sort: ['lastModifiedAt desc'],
          limit: 5,
          expand: CART_EXPAND,
        },
      })
      .execute(),
    'cart.byCustomer',
  );
  return body.results.find((cart) => ownsCart(cart, session) && matchesMarket(cart, ctx)) ?? null;
}

/** Creates the market's cart for this session (anonymous id from the session, minted when missing; the route persists it). */
export async function createCartForSession(session: SessionData, ctx: CartCtx): Promise<CtCart> {
  const owner = session.customerId ? { customerId: session.customerId } : { anonymousId: ensureAnonymousId(session).anonymousId };
  const draft: CartDraft = {
    currency: ctx.currency,
    country: ctx.country,
    locale: ctx.locale,
    taxMode: 'Platform',
    inventoryMode: 'None', // D-019
    origin: 'Customer',
    deleteDaysAfterLastModification: CART_DELETE_DAYS,
    ...owner,
    custom: { type: { typeId: 'type', key: 'malva-order' }, fields: {} },
  };
  const { body } = await withTimeout(getApiRoot().carts().post({ body: draft, queryArgs: { expand: CART_EXPAND } }).execute(), 'cart.create');
  return body;
}

/** One update with a fresh version. Returns the new cart (render from it, never patch local state). */
export async function updateCart(cart: Pick<CtCart, 'id' | 'version'>, actions: CartUpdateAction[]): Promise<CtCart> {
  const { body } = await withTimeout(
    getApiRoot().carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions }, queryArgs: { expand: CART_EXPAND } }).execute(),
    'cart.update',
  );
  return body;
}

/**
 * Re-reads the cart and runs `fn` with the FRESH cart (never a version captured earlier). On a 409 it re-reads and runs `fn` once
 * more; a second 409 throws ApiError CONFLICT with `details.reason = CART_CONFLICT`.
 */
export async function withCartRetry<T>(cartId: string, fn: (fresh: CtCart) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const fresh = await getCartById(cartId);
    if (!fresh) throw new ApiError('NOT_FOUND', 'Cart not found');
    try {
      return await fn(fresh);
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
      if (attempt >= 1) throw new ApiError('CONFLICT', 'The bundle changed at the same time, try again', { reason: CART_CONFLICT_REASON });
    }
  }
}

/** Arguments for the sign-in call that merges the anonymous cart into the customer's cart (R passes them; M never signs in). */
export function getSignInMergeArgs(session: SessionData): { anonymousCart?: { typeId: 'cart'; id: string }; anonymousCartSignInMode?: 'MergeWithExistingCustomerCart' } {
  if (session.customerId || !session.cartId) return {};
  return { anonymousCart: { typeId: 'cart', id: session.cartId }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' };
}

// ---- part 2: writes ----

const fieldsOf = (line: LineItem): Record<string, unknown> | undefined => line.custom?.fields as Record<string, unknown> | undefined;
const textField = (line: LineItem, name: string): string | undefined => {
  const value = fieldsOf(line)?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
};
export const offerKeyOfLine = (line: LineItem): string => textField(line, 'offerKey') ?? line.productKey ?? '';
export const parentIdOfLine = (line: LineItem): string | undefined => textField(line, 'parentLineItemId');

const lineNotFound = (): ApiError => new ApiError('NOT_FOUND', 'Line not found', { reason: 'LINE_NOT_FOUND' });

export interface AddOfferLineArgs {
  offer: Offer;
  variant: OfferVariant;
  quantity: number;
  /** Add-ons and equipment: the plan line they belong to (D-026). */
  parentLineId?: string;
  /** Plans: the equipment the plan requires (J `defaultEquipment` selections resolved to offers), added after the plan (D-025). */
  equipment?: { offer: Offer; variant: OfferVariant }[];
}

const isPlan = (offer: Offer): boolean => offer.kind === 'base-package' || offer.kind === 'bundle';

function feeQuantityActions(cart: CtCart, offerKey: string, quantity: number): CartUpdateAction[] {
  const fee = cart.customLineItems.find((item) => item.slug === feeSlug(offerKey));
  return fee && fee.quantity !== quantity ? [{ action: 'changeCustomLineItemQuantity', customLineItemId: fee.id, quantity }] : [];
}

/** Quantity change of a line and everything that follows it: its dependents (add-ons, equipment) and its activation fee. */
function quantityActions(cart: CtCart, line: LineItem, quantity: number): CartUpdateAction[] {
  const actions: CartUpdateAction[] = [{ action: 'changeLineItemQuantity', lineItemId: line.id, quantity }];
  const following = dependentQuantity(quantity);
  for (const other of cart.lineItems) {
    if (parentIdOfLine(other) === line.id && other.quantity !== following) actions.push({ action: 'changeLineItemQuantity', lineItemId: other.id, quantity: following });
  }
  if (!parentIdOfLine(line)) actions.push(...feeQuantityActions(cart, offerKeyOfLine(line), quantity));
  return actions;
}

/** The first of `lines` whose price carries no recurring price of the monthly policy (it would silently be charged the one-time price). */
async function firstWithoutRecurringPrice(lines: LineItem[]): Promise<LineItem | null> {
  const policy = await getMonthlyPolicy();
  for (const line of lines) {
    try {
      assertRecurringPrice(line, policy, line.variant.sku ?? '');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      console.error(`[catalog-gap] offer=${offerKeyOfLine(line)} sku=${line.variant.sku ?? ''} reason=no-recurring-price`);
      return line;
    }
  }
  return null;
}

const priceMissing = (sku: string): ApiError => new ApiError('VALIDATION', `No recurring price for ${sku}`, { reason: RECURRING_REASON.PRICE_MISSING, sku });

/**
 * Adds one offer to the bundle. Callers have already run the guard (rules, eligibility, stock) and `precheckPlan`; this function
 * only writes. Same sku + same custom fields again raises the existing line's quantity (phone plans; the guard refuses it for the rest).
 * Plans: the activation fee custom line item is added in the same update; required equipment follows in a second update because
 * its lines carry the plan's new line id. A recurring line without a recurring price is removed again (RECURRING_PRICE_MISSING).
 */
export async function addOfferLine(cartId: string, args: AddOfferLineArgs): Promise<CtCart> {
  const { offer, variant, quantity, parentLineId, equipment } = args;
  return withCartRetry(cartId, async (fresh) => {
    const existing = fresh.lineItems.find((line) => line.variant.sku === variant.sku && offerKeyOfLine(line) === offer.key && parentIdOfLine(line) === parentLineId);
    if (existing) return updateCart(fresh, quantityActions(fresh, existing, existing.quantity + quantity));

    const parent = parentLineId ? fresh.lineItems.find((line) => line.id === parentLineId) : undefined;
    if (parentLineId && !parent) throw lineNotFound();
    const lineQuantity = parent ? dependentQuantity(parent.quantity) : quantity;
    const known = new Set(fresh.lineItems.map((line) => line.id));
    const fee = isPlan(offer) ? activationFeeOf(offer, variant) : null;
    const actions: CartUpdateAction[] = [addLineItemAction({ offer, variant, quantity: lineQuantity, parentLineId })];
    const feeExists = fresh.customLineItems.some((item) => item.slug === feeSlug(offer.key));
    if (fee && !feeExists) actions.push(addFeeAction(offer.key, lineQuantity, fee));

    let cart = await updateCart(fresh, actions);
    const added = cart.lineItems.find((line) => !known.has(line.id));
    if (!added) throw new ApiError('INTERNAL', 'The line was not added');
    if (isRecurringVariant(offer, variant) && (await firstWithoutRecurringPrice([added]))) {
      const undo: CartUpdateAction[] = [{ action: 'removeLineItem', lineItemId: added.id }];
      const feeItem = cart.customLineItems.find((item) => item.slug === feeSlug(offer.key));
      if (fee && !feeExists && feeItem) undo.push({ action: 'removeCustomLineItem', customLineItemId: feeItem.id });
      await updateCart(cart, undo);
      throw priceMissing(variant.sku);
    }
    if (equipment && equipment.length > 0) {
      const before = new Set(cart.lineItems.map((line) => line.id));
      cart = await updateCart(
        cart,
        equipment.map((entry) => addLineItemAction({ offer: entry.offer, variant: entry.variant, quantity: 1, parentLineId: added.id })),
      );
      const recurringSkus = new Set(equipment.filter((entry) => isRecurringVariant(entry.offer, entry.variant)).map((entry) => entry.variant.sku));
      const created = cart.lineItems.filter((line) => !before.has(line.id) && recurringSkus.has(line.variant.sku ?? ''));
      const bad = await firstWithoutRecurringPrice(created);
      if (bad) {
        await updateCart(cart, [{ action: 'removeLineItem', lineItemId: bad.id }]);
        throw priceMissing(bad.variant.sku ?? '');
      }
    }
    return cart;
  });
}

/** Sets a line's quantity; its dependents and its activation fee follow in the same update. The caller validated the range and the stock. */
export async function changeLineQuantity(cartId: string, lineId: string, quantity: number): Promise<CtCart> {
  return withCartRetry(cartId, async (fresh) => {
    const line = fresh.lineItems.find((candidate) => candidate.id === lineId);
    if (!line) throw lineNotFound();
    if (line.quantity === quantity) return fresh;
    return updateCart(fresh, quantityActions(fresh, line, quantity));
  });
}

/** Lines that go with `lineId` (add-ons and equipment of a plan). */
export function dependentsOfLine(cart: CtCart, lineId: string): LineItem[] {
  return cart.lineItems.filter((line) => parentIdOfLine(line) === lineId);
}

/**
 * Removes a line. A line with dependents needs `cascade: true` (the buyer confirmed, D-026), otherwise ApiError CONFLICT with
 * `details.reason = HAS_DEPENDENTS` and `details.dependents`. The activation fee goes with the last plan of its offer.
 */
export async function removeLine(cartId: string, lineId: string, opts: { cascade: boolean; locale: string }): Promise<CtCart> {
  return withCartRetry(cartId, async (fresh) => {
    const line = fresh.lineItems.find((candidate) => candidate.id === lineId);
    if (!line) throw lineNotFound();
    const dependents = dependentsOfLine(fresh, lineId);
    if (dependents.length > 0 && !opts.cascade) {
      throw new ApiError('CONFLICT', 'The line has dependents', {
        reason: 'HAS_DEPENDENTS',
        dependents: dependents.map((dependent) => ({ lineId: dependent.id, name: getLocalizedString(dependent.name as Record<string, string>, opts.locale) })),
      });
    }
    const removed = new Set([lineId, ...dependents.map((dependent) => dependent.id)]);
    const actions: CartUpdateAction[] = [...removed].map((id) => ({ action: 'removeLineItem', lineItemId: id }));
    const offerKey = offerKeyOfLine(line);
    const feeItem = fresh.customLineItems.find((item) => item.slug === feeSlug(offerKey));
    const planLeft = fresh.lineItems.some((other) => !removed.has(other.id) && offerKeyOfLine(other) === offerKey && !parentIdOfLine(other));
    if (feeItem && !parentIdOfLine(line) && !planLeft) actions.push({ action: 'removeCustomLineItem', customLineItemId: feeItem.id });
    return updateCart(fresh, actions);
  });
}

/**
 * Idempotent repair after a merge of an anonymous cart: caps a phone plan at 5 lines, re-links a dependent whose parent id no longer
 * exists when exactly one plan line can be its parent, and keeps one fee line per offer with the plan's quantity. Never removes a
 * line the buyer chose. Writes nothing (and returns the same object) when nothing is wrong.
 */
export async function normalizeCart(cart: CtCart, offersByKey: Record<string, Offer>): Promise<CtCart> {
  const actions: CartUpdateAction[] = [];
  const planOf = (line: LineItem): Offer | undefined => {
    const offer = offersByKey[offerKeyOfLine(line)];
    return offer && isPlan(offer) ? offer : undefined;
  };
  const planLines = cart.lineItems.filter((line) => planOf(line));
  const quantityOf = new Map<string, number>();
  for (const line of planLines) {
    const offer = planOf(line);
    const isPhone = offer?.facts?.kind === 'plan' && offer.facts.family === 'phone';
    const capped = isPhone ? Math.min(line.quantity, MAX_PHONE_LINES) : line.quantity;
    quantityOf.set(line.id, capped);
    if (capped !== line.quantity) actions.push({ action: 'changeLineItemQuantity', lineItemId: line.id, quantity: capped });
  }
  const ids = new Set(cart.lineItems.map((line) => line.id));
  const onlyPlan = planLines.length === 1 ? planLines[0] : undefined;
  for (const line of cart.lineItems) {
    const parent = parentIdOfLine(line);
    if (parent && !ids.has(parent) && onlyPlan) {
      actions.push({ action: 'setLineItemCustomField', lineItemId: line.id, name: 'parentLineItemId', value: onlyPlan.id });
    }
  }
  const seen = new Set<string>();
  for (const item of cart.customLineItems) {
    if (!item.slug.startsWith(ACTIVATION_FEE_SLUG_PREFIX)) continue;
    if (seen.has(item.slug)) {
      actions.push({ action: 'removeCustomLineItem', customLineItemId: item.id });
      continue;
    }
    seen.add(item.slug);
    const plan = planLines.find((line) => offerKeyOfLine(line) === item.slug.slice(ACTIVATION_FEE_SLUG_PREFIX.length));
    const wanted = plan ? (quantityOf.get(plan.id) ?? plan.quantity) : undefined;
    if (wanted !== undefined && wanted !== item.quantity) actions.push({ action: 'changeCustomLineItemQuantity', customLineItemId: item.id, quantity: wanted });
  }
  if (actions.length === 0) return cart;
  return updateCart(cart, actions);
}

/** Removes a cart (probe carts of the discount prompt). */
export async function deleteCart(cart: Pick<CtCart, 'id' | 'version'>): Promise<void> {
  await withTimeout(getApiRoot().carts().withId({ ID: cart.id }).delete({ queryArgs: { version: cart.version } }).execute(), 'cart.delete');
}
