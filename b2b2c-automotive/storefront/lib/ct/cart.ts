// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Cart reads and writes of the storefront. Workstream I added `getCartSummary` and the `rescopeCartToBranch` seam;
// workstreams L and N extend THIS file (do not create a second cart module).
import 'server-only';
import type { Cart, CartUpdateAction, ProductProjection } from '@commercetools/platform-sdk';
import type { AppLocale } from '@/i18n/config';
import { ApiError } from '@/lib/api';
import { CART_EXPAND } from '@/lib/ct/cart-discounts';
import { withCartRetry } from '@/lib/ct/cart-retry';
import { apiRoot } from '@/lib/ct/client';
import { PICKUP_BRANCH_FIELD, type PickupPlace } from '@/lib/ct/delivery';
import { inStore } from '@/lib/ct/in-store';
import { getLineStock, type LineStock } from '@/lib/ct/inventory';
import { getStandalonePrices } from '@/lib/ct/prices';
import { getShellContext } from '@/lib/ct/shell';
import { getFitState } from '@/lib/search/fitment';
import type { BranchScope } from '@/lib/store/branch-scope';
import { selectStandalonePrice } from '@/lib/store/standalone-price';
import { POLICY_KEY_PREFIX, subscriptionsPurchaseEnabled, SUBSCRIPTION_PRICE_MODE } from '@/lib/subscriptions/config';
import type { PriceCandidate, Session } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/** The header badge: units in the cart (2 units plus 1 unit is 3, not 2 lines). A missing or deleted cart is 0. */
export async function getCartSummary(storeKey: string, cartId: string | undefined): Promise<{ count: number }> {
  if (!cartId) return { count: 0 };
  try {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).get().execute();
    return { count: (body.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0) };
  } catch (error) {
    if (statusOf(error) === 404) return { count: 0 };
    throw error;
  }
}

// ---- Cart operations of workstream N (read, quantity, remove, recalculate, branch re-scope) ----

/** What a fresh cart carries (D1, D2, D13): store scope, one shipping address, Platform tax, `TrackOnly` (the app caps stock itself). */
const CART_DEFAULTS = {
  shippingMode: 'Single',
  taxMode: 'Platform',
  taxRoundingMode: 'HalfEven',
  taxCalculationMode: 'LineItemLevel',
  inventoryMode: 'TrackOnly',
  deleteDaysAfterLastModification: 30,
} as const;

export interface CreateCartInput {
  storeKey: string;
  locale: AppLocale;
  anonymousId?: string;
  customerId?: string;
  customerEmail?: string;
}

/** Currency, country and locale come from `COUNTRY_CONFIG[locale]`, never from literals (D2). A signed-in shopper gets a customer cart, else an anonymous one. */
export async function createCart(input: CreateCartInput): Promise<Cart> {
  const { currency, country } = COUNTRY_CONFIG[input.locale];
  const owner = input.customerId ? { customerId: input.customerId, ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}) } : { anonymousId: input.anonymousId ?? crypto.randomUUID() };
  const { body } = await inStore(input.storeKey)
    .carts()
    .post({ body: { currency, country, locale: input.locale, shippingAddress: { country }, ...CART_DEFAULTS, ...owner } })
    .execute();
  return body;
}

/** The cart with the expansions the view needs, or null when it is gone (404) or not Active (ordered, merged, frozen). The caller then clears `cartId`. */
export async function getCart(storeKey: string, cartId: string): Promise<Cart | null> {
  try {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).get({ queryArgs: { expand: CART_EXPAND } }).execute();
    return body.cartState === 'Active' ? body : null;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

export async function postActions(storeKey: string, cartId: string, actions: CartUpdateAction[]): Promise<Cart> {
  return withCartRetry(storeKey, cartId, async (current) => {
    const { body } = await inStore(storeKey)
      .carts()
      .withId({ ID: cartId })
      .post({ body: { version: current.version, actions }, queryArgs: { expand: CART_EXPAND } })
      .execute();
    return body;
  });
}

/** Sets a line to `quantity` (at least 1; use `removeLine` for none). */
export async function setLineQuantity(storeKey: string, cartId: string, lineItemId: string, quantity: number): Promise<Cart> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, 'Quantity must be at least 1');
  return postActions(storeKey, cartId, [{ action: 'changeLineItemQuantity', lineItemId, quantity }]);
}

export async function removeLine(storeKey: string, cartId: string, lineItemId: string): Promise<Cart> {
  return postActions(storeKey, cartId, [{ action: 'removeLineItem', lineItemId }]);
}

/** Re-prices every line to the current standalone prices and product data (D11); carts snapshot prices. */
export async function recalculate(storeKey: string, cartId: string): Promise<Cart> {
  return postActions(storeKey, cartId, [{ action: 'recalculate', updateProductData: true }]);
}

/** The channel a line should price from and the channel it should be supplied from after a branch change. */
export interface RescopePlan {
  actions: CartUpdateAction[];
  /** SKUs with no standalone price in the new scope (branch, retail channel, base): the line is kept as it is. */
  unpriced: string[];
}

/**
 * Pure: the update actions that point every line at the new branch (D6). Distribution channel = channel of the standalone price
 * selected for the sku (branch, store retail channel, none for the base price); supply channel = the branch when it can cover the
 * line, else none. Recurrence info is not touched. No lines to change gives an empty `actions` (no call, no recalculate).
 */
export function planRescope(
  cart: Cart,
  scope: BranchScope,
  prices: Map<string, PriceCandidate[]>,
  stock: Map<string, LineStock>,
  place: PickupPlace | null,
): RescopePlan {
  const country = cart.country ?? 'DE';
  const currency = cart.totalPrice.currencyCode;
  const actions: CartUpdateAction[] = [];
  const unpriced: string[] = [];
  for (const line of cart.lineItems ?? []) {
    const sku = line.variant.sku ?? '';
    const selected = selectStandalonePrice(prices.get(sku) ?? [], { currency, country, channelIds: [scope.branchChannelId, scope.retailChannelId] });
    if (!selected) {
      unpriced.push(sku);
      continue;
    }
    if ((selected.channelId ?? undefined) !== line.distributionChannel?.id) {
      actions.push({ action: 'setLineItemDistributionChannel', lineItemId: line.id, ...(selected.channelId ? { distributionChannel: channelRef(selected.channelId) } : {}) });
    }
    const supply = scope.branchChannelId && (stock.get(sku)?.branchQty ?? 0) >= line.quantity ? scope.branchChannelId : undefined;
    if (supply !== line.supplyChannel?.id) {
      actions.push({ action: 'setLineItemSupplyChannel', lineItemId: line.id, ...(supply ? { supplyChannel: channelRef(supply) } : {}) });
    }
  }
  const pickup = cart.custom?.fields?.[PICKUP_BRANCH_FIELD] !== undefined;
  if (pickup && place && cart.custom?.fields?.[PICKUP_BRANCH_FIELD] !== place.key) {
    actions.push({ action: 'setShippingAddress', address: { country, city: place.address.city, postalCode: place.address.postalCode, streetName: place.address.street } });
    actions.push({ action: 'setCustomField', name: PICKUP_BRANCH_FIELD, value: place.key });
  }
  if (actions.length > 0) actions.push({ action: 'recalculate', updateProductData: true });
  return { actions, unpriced };
}

/** The scope-dependent reads for `planRescope`: standalone prices of the cart's skus in one call and the stock of the branch. */
export async function loadRescopeInputs(cart: Cart, scope: BranchScope) {
  const skus = (cart.lineItems ?? []).map((l) => l.variant.sku).filter((s): s is string => Boolean(s));
  const [prices, stock] = await Promise.all([
    getStandalonePrices(skus, { currency: cart.totalPrice.currencyCode, channelIds: [scope.branchChannelId, scope.retailChannelId] }),
    getLineStock(skus, scope.branchChannelId),
  ]);
  return { prices, stock };
}

/** The pickup branch of the scope, for the address of a pickup cart. */
export async function pickupPlaceOf(storeKey: string, locale: string, branchKey: string | undefined): Promise<PickupPlace | null> {
  if (!branchKey) return null;
  const shell = await getShellContext(storeKey, locale);
  const branch = shell?.branches.find((b) => b.key === branchKey);
  return branch ? { key: branch.key, address: branch.address } : null;
}

export interface RescopeResult {
  cart: Cart;
  changed: boolean;
  unpriced: string[];
}

/** One update with the actions of `planRescope`, then the cart as commercetools returns it. Lines without a price in scope are reported, never dropped. */
export async function rescopeCart(storeKey: string, cartId: string, scope: BranchScope): Promise<RescopeResult> {
  const cart = await withCartRetry(storeKey, cartId, async (current) => current);
  const place = await pickupPlaceOf(storeKey, cart.locale ?? 'de-DE', scope.branchKey);
  const { prices, stock } = await loadRescopeInputs(cart, scope);
  const plan = planRescope(cart, scope, prices, stock, place);
  if (plan.actions.length === 0) return { cart, changed: false, unpriced: plan.unpriced };
  const updated = await postActions(storeKey, cartId, plan.actions);
  return { cart: updated, changed: true, unpriced: plan.unpriced };
}

/** Called by `POST /api/store-context/branch` (workstream I) after the shopper picks another branch. Returns whether the cart was re-priced. */
export async function rescopeCartToBranch(storeKey: string, cartId: string, scope: BranchScope): Promise<boolean> {
  return (await rescopeCart(storeKey, cartId, scope)).changed;
}

// ---- Add to cart (workstream L, L-06; M and N reuse `addLineToCart` and extend it) ----

/** The shopper's market and branch for one cart write. */
export interface AddLineContext {
  storeKey: string;
  locale: string;
  currency: string;
  country: string;
  scope: BranchScope;
}
export interface AddLineInput {
  sku: string;
  quantity: number;
  /**
   * Subscription policy key sent by the product page (M-06). Applied as `recurrenceInfo` only for a `recurring-eligible` product and
   * an existing `mau-rp-*` policy (else 422 `not-subscribable`, also when `SUBSCRIPTIONS_PURCHASE_ENABLED=false`); cards never send it.
   */
  recurrencePolicyKey?: string;
  /** The active vehicle at the time of the add: the line records its fitment key and the fit of the part (`malva-line`). */
  vehicle?: { fitmentKey: string; make: string; model: string; year: number; engine: string };
}
export interface AddLineResult {
  cartId: string;
  /** Units in the cart after the add. */
  count: number;
  /** Set only when this call minted an anonymous id for the shopper: the caller writes it to the session. */
  anonymousId?: string;
}

const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const channelRef = (id: string) => ({ typeId: 'channel' as const, id });

const attributeOf = (product: ProductProjection, name: string): unknown => {
  const all = [product.masterVariant, ...(product.variants ?? [])];
  return all.flatMap((v) => v.attributes ?? []).find((a) => a.name === name)?.value;
};

/** `recurrenceInfo` for the subscribe option (D18): the product must be `recurring-eligible` and the policy must exist (404 = no such policy). */
async function resolveRecurrence(product: ProductProjection, policyKey: string) {
  if (!subscriptionsPurchaseEnabled() || !policyKey.startsWith(POLICY_KEY_PREFIX) || attributeOf(product, 'recurring-eligible') !== true) {
    throw new ApiError(422, 'not-subscribable');
  }
  try {
    await apiRoot.recurrencePolicies().withKey({ key: policyKey }).get().execute();
  } catch (error) {
    if (statusOf(error) === 404) throw new ApiError(422, 'not-subscribable');
    throw error;
  }
  return { recurrencePolicy: { typeId: 'recurrence-policy' as const, key: policyKey }, priceSelectionMode: SUBSCRIPTION_PRICE_MODE };
}

/** The `malva-line` fields, only with an active vehicle: its fitment key and the fit of this part (`fits`, `not-fit`, `unknown`). */
function lineFitCustom(product: ProductProjection, vehicle: NonNullable<AddLineInput['vehicle']>) {
  const keys = attributeOf(product, 'fitment-keys');
  const state = getFitState({ fitmentKeys: Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [], universalFit: attributeOf(product, 'universal-fit') === true }, vehicle);
  const fit = state === 'fits' ? 'fits' : state === 'does-not-fit' ? 'not-fit' : 'unknown';
  return { type: { typeId: 'type' as const, key: 'malva-line' }, fields: { vehicleFitmentKey: vehicle.fitmentKey, fit } };
}
const unitsOf = (cart: Cart): number => (cart.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0);
const hasMissingPrice = (error: unknown): boolean =>
  statusOf(error) === 400 && ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).some((e) => e.code === 'MissingPrice');

/**
 * Adds `quantity` units of `sku` to the shopper's cart of the store, creating the cart when the session has none (or its cart is
 * gone or no longer active). The line carries the channel of the standalone price that price selection picks (branch, store
 * retail channel, or none for the Malva base price, D4) and the branch as supply channel only when the branch has enough stock.
 * Errors: 400 invalid sku, 404 sku not in the store's assortment, 422 `price-unavailable`, 409 after one retry.
 */
export async function addLineToCart(
  ctx: AddLineContext,
  session: Pick<Session, 'cartId' | 'customerId' | 'anonymousId'>,
  input: AddLineInput,
): Promise<AddLineResult> {
  const { sku, quantity } = input;
  if (!SKU.test(sku)) throw new ApiError(400, 'Invalid sku');

  const inAssortment = await apiRoot
    .productProjections()
    .get({ queryArgs: { storeProjection: ctx.storeKey, where: `masterVariant(sku="${sku}")`, limit: 1 } })
    .execute();
  const product = inAssortment.body.results[0];
  if (!product) throw new ApiError(404, 'Not found');
  const recurrenceInfo = input.recurrencePolicyKey ? await resolveRecurrence(product, input.recurrencePolicyKey) : undefined;
  const lineCustom = input.vehicle ? lineFitCustom(product, input.vehicle) : undefined;

  const channelIds = [ctx.scope.branchChannelId, ctx.scope.retailChannelId] as const;
  const prices = await getStandalonePrices([sku], { currency: ctx.currency, channelIds });
  const selected = selectStandalonePrice(prices.get(sku) ?? [], { currency: ctx.currency, country: ctx.country, channelIds });
  if (!selected) throw new ApiError(422, 'price-unavailable');

  let supplyChannelId: string | undefined;
  if (ctx.scope.branchChannelId) {
    const { body } = await apiRoot
      .inventory()
      .get({ queryArgs: { where: `sku="${sku}" and supplyChannel(id="${ctx.scope.branchChannelId}")`, limit: 1 } })
      .execute();
    if ((body.results[0]?.availableQuantity ?? 0) >= quantity) supplyChannelId = ctx.scope.branchChannelId;
  }

  const carts = inStore(ctx.storeKey).carts();
  let anonymousId: string | undefined;
  const create = async (): Promise<Cart> => {
    if (!session.customerId) anonymousId = session.anonymousId ?? crypto.randomUUID();
    const { body } = await carts
      .post({
        body: {
          currency: ctx.currency,
          country: ctx.country,
          locale: ctx.locale,
          shippingAddress: { country: ctx.country },
          ...CART_DEFAULTS,
          ...(session.customerId ? { customerId: session.customerId } : { anonymousId }),
        },
      })
      .execute();
    return body;
  };
  const load = async (id: string): Promise<Cart | null> => {
    try {
      const { body } = await carts.withId({ ID: id }).get().execute();
      return body.cartState === 'Active' && body.totalPrice.currencyCode === ctx.currency ? body : null;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  };

  let cart = (session.cartId ? await load(session.cartId) : null) ?? (await create());
  const action: CartUpdateAction = {
    action: 'addLineItem',
    sku,
    quantity,
    ...(selected.channelId ? { distributionChannel: channelRef(selected.channelId) } : {}),
    ...(supplyChannelId ? { supplyChannel: channelRef(supplyChannelId) } : {}),
    ...(recurrenceInfo ? { recurrenceInfo } : {}),
    ...(lineCustom ? { custom: lineCustom } : {}),
  };
  const push = async (current: Cart): Promise<Cart> => {
    const { body } = await carts.withId({ ID: current.id }).post({ body: { version: current.version, actions: [action] } }).execute();
    return body;
  };
  try {
    try {
      cart = await push(cart);
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
      // The cart changed under us (a second tab, a double click): one retry on the current version.
      const fresh = await load(cart.id);
      if (!fresh) throw error;
      cart = await push(fresh);
    }
  } catch (error) {
    if (hasMissingPrice(error)) throw new ApiError(422, 'price-unavailable');
    throw error;
  }
  return { cartId: cart.id, count: unitsOf(cart), ...(anonymousId ? { anonymousId } : {}) };
}
