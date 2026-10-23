import 'server-only';
import type { Cart, CartAddLineItemAction, CartUpdateAction } from '@commercetools/platform-sdk';
import { getTranslations } from 'next-intl/server';
import { isCodeRejectionReason, type CodeRejectionReason } from '@/lib/cart/discount-reasons';
import { planFulfilmentSwitch, planStoreChange, shippingMethodKeyFor, type PlanLine, type PlanOp } from '@/lib/cart/plan';
import { getCartEnrichment } from '@/lib/ct/cart-enrich';
import { apiRoot } from '@/lib/ct/client';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getInventoryDetail, getStoreStock } from '@/lib/ct/inventory';
import { getProductBySku, getRecurrencePolicies, getRecurrencePolicyByKey } from '@/lib/ct/product-detail';
import { updateWithRetry } from '@/lib/ct/retry';
import type { DomainErrorCode } from '@/lib/api-domain';
import { AppError } from '@/lib/errors';
import { detectPriceChanges, fulfilmentOf, mapCart, mapCartSummary } from '@/lib/mappers/cart';
import { ensureAnonymousId, type Session } from '@/lib/session';
import { CART_MAX_LINE_QUANTITY, CART_SHIPPING_MODE, MIN_ORDER_VALUE } from '@/lib/shop-config';
import type { VariantTranslator } from '@/lib/cart/summary';
import type { Cart as CartView, CartSummary, DroppedLine, Money } from '@/lib/types';
import { getLocalizedString, marketForCountry } from '@/lib/utils';

/**
 * Cart core (workstream G, decision D-024). Exports for H and I:
 *  - `getCartForSession(session)`: the session's active cart summary or null (the caller clears `cartId` on null).
 *  - `createCart(session, market)`: a new cart for the session market; returns the summary and the session to persist.
 *  - `addLine(session, market, input)`: get or create, then `addLineItem` with the fulfilment custom field, one retry on
 *    409. `AddLineInput` already has the full union; H adds the `collect` and `subscribe` branches.
 * Units in the cart: `getCartUnitCount`.
 */
export interface CartMarket { country: string; currency: string; locale: string }

export type AddLineInput =
  | { sku: string; quantity: number; fulfilment: 'delivery' }
  | { sku: string; quantity: number; fulfilment: 'collect'; storeKey: string }
  | { sku: string; quantity: number; fulfilment: 'subscribe'; recurrencePolicyKey: string };

/** Units in the cart (sum of line quantities, not lines), or null when the cart is gone or no longer Active. */
export async function getCartUnitCount(cartId: string): Promise<number | null> {
  const cart = await getActiveCart(cartId);
  return cart ? mapCartSummary(cart).count : null;
}

async function getActiveCart(cartId: string): Promise<Cart | null> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
    return body.cartState === 'Active' ? body : null;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}

export async function getCartForSession(session: Session): Promise<CartSummary | null> {
  if (!session.cartId) return null;
  const cart = await getActiveCart(session.cartId);
  return cart ? mapCartSummary(cart) : null;
}

async function createRawCart(
  session: Session,
  market: CartMarket,
  shippingMode: 'Single' | 'Multiple' = CART_SHIPPING_MODE,
): Promise<{ cart: Cart; session: Session }> {
  const next = session.customerId ? session : ensureAnonymousId(session);
  const { body } = await apiRoot
    .carts()
    .post({
      body: {
        currency: market.currency,
        country: market.country,
        locale: market.locale,
        shippingMode,
        ...(next.customerId ? { customerId: next.customerId } : { anonymousId: next.anonymousId }),
        deleteDaysAfterLastModification: 30,
        shippingAddress: { country: market.country },
        taxMode: 'Platform',
      },
    })
    .execute();
  return { cart: body, session: { ...next, cartId: body.id } };
}

export async function createCart(session: Session, market: CartMarket): Promise<{ cart: CartSummary; session: Session }> {
  const created = await createRawCart(session, market);
  return { cart: mapCartSummary(created.cart), session: created.session };
}

interface CtErrorLike { statusCode?: number; body?: { errors?: { code?: string; message?: string }[] } }

/** commercetools add-line failures that the shopper can act on, as safe app errors. */
function toLineError(e: unknown): unknown {
  const err = e as CtErrorLike;
  const first = err?.body?.errors?.[0];
  if (err?.statusCode === 400 && first?.code === 'MissingPriceForProduct') return new AppError('validation_failed', 422);
  if (err?.statusCode === 400 && (first?.code === 'InvalidOperation' || first?.code === 'InvalidField') && /sku/i.test(first.message ?? '')) {
    return new AppError('not_found', 404);
  }
  if (err?.statusCode === 404) return new AppError('not_found', 404);
  return e;
}

/** A line the shopper cannot add, with a code the product page explains (an `api-domain` code, never commercetools text). */
export class LineRejected extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly status: number,
    readonly extra: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = 'LineRejected';
  }
}

/** What the validated input resolved to: the store channel for collect, the policy id for subscribe. */
export interface LineTargets { channelId?: string; policyId?: string }

const LINE_TYPE = { typeId: 'type', key: 'mcf-line-fulfilment' } as const;

/**
 * The `addLineItem` update action for a line (workstream H, 3.10). Pure. Exported for I (re-adding a line) and K.
 *  - delivery: the SKU, the quantity and `fulfilment = delivery`; no supply channel.
 *  - collect: also the store's `supplyChannel` (a resource identifier object, never a string) and `fulfilment = collect`,
 *    so a different store or a delivery line of the same SKU is a different line.
 *  - subscribe: also `recurrenceInfo { recurrencePolicy, priceSelectionMode: 'Fixed' }` and `fulfilment = subscribe`.
 * A one-time line never carries a `recurrenceInfo` key, not even `undefined`.
 */
export function buildAddLineAction(input: AddLineInput, targets: LineTargets = {}): CartAddLineItemAction {
  const base = {
    action: 'addLineItem' as const,
    sku: input.sku,
    quantity: input.quantity,
    custom: { type: LINE_TYPE, fields: { fulfilment: input.fulfilment } },
  };
  if (input.fulfilment === 'collect') {
    if (!targets.channelId) throw new LineRejected('unknown_store', 400);
    return { ...base, supplyChannel: { typeId: 'channel', id: targets.channelId } };
  }
  if (input.fulfilment === 'subscribe') {
    if (!targets.policyId) throw new LineRejected('unknown_policy', 400);
    return {
      ...base,
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: targets.policyId }, priceSelectionMode: 'Fixed' },
    };
  }
  return base;
}

/** Checks a collect or subscribe line against the project before the cart is touched. Delivery needs nothing. */
async function resolveTargets(market: CartMarket, input: AddLineInput): Promise<LineTargets> {
  if (input.fulfilment === 'delivery') return {};
  if (input.fulfilment === 'collect') {
    if (!marketForCountry(market.country)?.collection) throw new LineRejected('collect_not_available_in_market', 400);
    const stores = await getStoresForCountry(market.country, market.locale);
    const store = stores.find((s) => s.key === input.storeKey);
    if (!store) throw new LineRejected('unknown_store', 400);
    const available = await getStoreStock(input.sku, store.id);
    if (available < input.quantity) throw new LineRejected('not_available_for_collection', 409, { available });
    return { channelId: store.id };
  }
  const policy = await getRecurrencePolicyByKey(input.recurrencePolicyKey, market.locale);
  if (!policy) throw new LineRejected('unknown_policy', 400);
  const projection = await getProductBySku(input.sku, market);
  if (!projection) throw new AppError('not_found', 404);
  const variant = [projection.masterVariant, ...projection.variants].find((v) => v.sku === input.sku);
  const subscribable = isSubscribable(variant, projection.attributes);
  const hasPrice = (variant?.recurrencePrices ?? []).some(
    (p) =>
      p.recurrencePolicy?.id === policy.id &&
      p.value.currencyCode === market.currency &&
      (p.country === undefined || p.country === market.country) &&
      p.value.centAmount > 0,
  );
  if (!subscribable || !hasPrice) throw new LineRejected('price_unavailable', 422);
  return { policyId: policy.id };
}

/** `subscribable` is a variant attribute (the seed writes it into every variant, product-level `attributes` is empty); a product-level one is accepted too. */
export function isSubscribable(
  variant: { attributes?: { name: string; value?: unknown }[] } | undefined,
  productAttributes?: { name: string; value?: unknown }[],
): boolean {
  const flag = (xs?: { name: string; value?: unknown }[]) => xs?.find((a) => a.name === 'subscribable')?.value;
  return (flag(variant?.attributes) ?? flag(productAttributes)) === true;
}

export async function addLine(
  session: Session,
  market: CartMarket,
  input: AddLineInput,
): Promise<{ cart: CartSummary; session: Session }> {
  const targets = await resolveTargets(market, input);
  const action = buildAddLineAction(input, targets);
  let next = session;
  let cart = session.cartId ? await getActiveCart(session.cartId) : null;
  if (!cart) {
    const created = await createRawCart(session, market);
    cart = created.cart;
    next = created.session;
  }
  const cartId = cart.id;
  try {
    const updated = await updateWithRetry(
      async () => (await apiRoot.carts().withId({ ID: cartId }).get().execute()).body,
      async (current) =>
        (await apiRoot.carts().withId({ ID: cartId }).post({ body: { version: current.version, actions: [action] } }).execute()).body,
    );
    return { cart: mapCartSummary(updated), session: next };
  } catch (e) {
    const code = (e as CtErrorLike)?.body?.errors?.[0]?.code;
    if (input.fulfilment === 'subscribe' && code === 'MissingPriceForProduct') throw new LineRejected('price_unavailable', 422);
    throw toLineError(e);
  }
}

// ---------------------------------------------------------------- workstream I: the full cart
//
// Every write: read the latest cart, verify ownership, post the update with its version, render from the response, and on a 409
// re-read once (updateWithRetry; a second conflict is `conflict`). Totals are never computed here: they come from the cart the
// engine returns (see lib/mappers/cart.ts).

export interface CartViewResult {
  cart: CartView | null;
  /** The session to persist: `cartId` removed when the cart is gone or foreign, replaced when the cart was rebuilt. */
  session: Session;
}

/** Expanded on every read and write: the code objects (code text and name) and the shipping method (its key). */
const CART_EXPAND = ['discountCodes[*].discountCode', 'shippingInfo.shippingMethod'];

/** A cart belongs to the session that created it: same anonymous id, or same customer. Anything else is "no cart". */
export function ownsCart(cart: Pick<Cart, 'anonymousId' | 'customerId'>, session: Pick<Session, 'anonymousId' | 'customerId'>): boolean {
  if (session.customerId && cart.customerId === session.customerId) return true;
  return Boolean(session.anonymousId && cart.anonymousId === session.anonymousId);
}

/** The session's cart with expansions, or null when it is gone, not Active or belongs to someone else. */
async function readOwnedCart(session: Session): Promise<Cart | null> {
  if (!session.cartId) return null;
  try {
    const { body } = await apiRoot.carts().withId({ ID: session.cartId }).get({ queryArgs: { expand: CART_EXPAND } }).execute();
    return body.cartState === 'Active' && ownsCart(body, session) ? body : null;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}

async function variantTranslator(locale: string): Promise<VariantTranslator> {
  const t = await getTranslations({ locale, namespace: 'cart' });
  return ((key: string, values: Record<string, string | number>) => t(key as 'variant.grams', values)) as VariantTranslator;
}

/** The view of a commercetools cart: enrichment reads plus the pure mapper. `previousPrices` marks lines whose price just changed. */
async function viewOf(ct: Cart, session: Session, market: CartMarket, previousPrices?: Record<string, Money>): Promise<CartView> {
  const country = ct.country ?? market.country;
  const currency = ct.totalPrice.currencyCode;
  const [enrichment, t] = await Promise.all([
    getCartEnrichment(ct, { locale: market.locale, country, currency, ...(session.collectionStoreKey ? { sessionStoreKey: session.collectionStoreKey } : {}) }),
    variantTranslator(market.locale),
  ]);
  const prices = previousPrices ?? detectPriceChanges(ct, enrichment);
  return mapCart(ct, enrichment, {
    locale: market.locale, t, collection: Boolean(marketForCountry(country)?.collection), minOrder: MIN_ORDER_VALUE[currency],
    previousPrices: prices,
  });
}

async function postUpdate(cartId: string, version: number, actions: CartUpdateAction[]): Promise<Cart> {
  const { body } = await apiRoot.carts().withId({ ID: cartId }).post({ body: { version, actions }, queryArgs: { expand: CART_EXPAND } }).execute();
  return body;
}

/**
 * Runs `build` against the latest owned cart and posts its actions (none: nothing is posted). One re-read on a 409.
 * `build` runs again on the fresh cart, so a plan is never applied to stale state.
 */
async function mutateCart(session: Session, build: (current: Cart) => Promise<CartUpdateAction[]> | CartUpdateAction[]): Promise<Cart> {
  const cartId = session.cartId;
  if (!cartId) throw new AppError('not_found', 404);
  return updateWithRetry(
    async () => {
      const cart = await readOwnedCart(session);
      if (!cart) throw new AppError('not_found', 404);
      return cart;
    },
    async (current) => {
      const actions = await build(current);
      return actions.length === 0 ? current : postUpdate(cartId, current.version, actions);
    },
  );
}

/**
 * Prices shipping (`Single` mode, Q-I-04): the standard method when any line is delivery or subscribe, else the collect
 * method. Writes only when the cart's method differs. Failures are swallowed: the cart then shows "calculated at checkout".
 * `Multiple` mode is K's: nothing happens.
 */
export async function syncShippingMethod(cart: Cart): Promise<Cart> {
  if (cart.shippingMode === 'Multiple') return cart;
  const wanted = shippingMethodKeyFor(cart.lineItems.map(fulfilmentOf));
  if (!wanted) return cart;
  const info = cart.shippingInfo;
  const current = info?.shippingMethod?.obj?.key;
  if (info && current === wanted && info.shippingMethodState !== 'DoesNotMatchCart') return cart;
  if (info && !info.shippingMethod?.obj) return cart; // the method key is unknown (not expanded): never write blind
  try {
    return await updateWithRetry(
      async () => (await apiRoot.carts().withId({ ID: cart.id }).get({ queryArgs: { expand: CART_EXPAND } }).execute()).body,
      (c) => postUpdate(c.id, c.version, [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: wanted } }]),
    );
  } catch {
    return cart;
  }
}

/** `recalculate` with `updateProductData` so changed variant prices reach the lines. Returns the updated cart. */
export async function refreshPrices(cart: Cart): Promise<Cart> {
  return updateWithRetry(
    async () => (await apiRoot.carts().withId({ ID: cart.id }).get({ queryArgs: { expand: CART_EXPAND } }).execute()).body,
    (c) => postUpdate(c.id, c.version, [{ action: 'recalculate', updateProductData: true }]),
  );
}

/**
 * The full cart view for a page or drawer load. Verifies ownership (a foreign, missing or non Active cart is "no cart" and its
 * id leaves the session), migrates a cart whose shipping mode differs from `CART_SHIPPING_MODE`, prices shipping, and runs the
 * price check: when a line's stored price differs from the price the shopper would get now, the cart is recalculated once and
 * the line is marked `price-updated` with the previous price. The count endpoint never calls this.
 */
export async function getCartView(session: Session, market: CartMarket): Promise<CartViewResult> {
  if (!session.cartId) return { cart: null, session };
  let current = session;
  let ct = await readOwnedCart(current);
  if (!ct) return { cart: null, session: withoutCart(session) };

  if (ct.shippingMode !== CART_SHIPPING_MODE) {
    const rebuilt = await rebuildCart(current, ct, { country: ct.country ?? market.country, currency: ct.totalPrice.currencyCode, locale: market.locale });
    current = rebuilt.session;
    ct = (await readOwnedCart(current)) ?? ct;
  }
  const country = ct.country ?? market.country;
  const enrichment = await getCartEnrichment(ct, {
    locale: market.locale, country, currency: ct.totalPrice.currencyCode,
    ...(current.collectionStoreKey ? { sessionStoreKey: current.collectionStoreKey } : {}),
  });
  const changes = detectPriceChanges(ct, enrichment);
  if (Object.keys(changes).length > 0) ct = await refreshPrices(ct);
  ct = await syncShippingMethod(ct);
  const t = await variantTranslator(market.locale);
  const cart = mapCart(ct, enrichment, {
    locale: market.locale, t, collection: Boolean(marketForCountry(country)?.collection), minOrder: MIN_ORDER_VALUE[ct.totalPrice.currencyCode],
    previousPrices: changes,
  });
  return { cart, session: current };
}

function withoutCart(session: Session): Session {
  const next = { ...session };
  delete next.cartId;
  return next;
}

/** Writes, then prices shipping, then returns the view of the cart as the engine now has it. */
async function finish(session: Session, market: CartMarket, ct: Cart): Promise<CartView> {
  return viewOf(await syncShippingMethod(ct), session, market, {});
}

function lineOrThrow(cart: Cart, lineId: string) {
  const line = cart.lineItems.find((l) => l.id === lineId);
  if (!line) throw new LineRejected('line_not_found', 404);
  return line;
}

/** Stock a line can be raised to: the online warehouse for delivery and subscribe, the line's store for collect. */
async function availableFor(line: Cart['lineItems'][number]): Promise<number> {
  const sku = line.variant?.sku ?? '';
  const entry = (await getInventoryDetail([sku]))[sku];
  if (fulfilmentOf(line) === 'collect') return entry?.stores[line.supplyChannel?.id ?? ''] ?? 0;
  return entry?.online ?? 0;
}

/**
 * Sets a line's quantity (1 to 99; removal is `removeLine`, never a quantity of 0). Raising it above the stock is refused
 * with `quantity_exceeds_stock` and the available count; lowering is always allowed.
 */
export async function changeQuantity(session: Session, market: CartMarket, lineId: string, quantity: number): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > CART_MAX_LINE_QUANTITY) throw new LineRejected('invalid_request', 400);
  const ct = await mutateCart(session, async (current) => {
    const line = lineOrThrow(current, lineId);
    if (quantity === line.quantity) return [];
    if (quantity > line.quantity) {
      const available = await availableFor(line);
      if (quantity > available) throw new LineRejected('quantity_exceeds_stock', 409, { available });
    }
    return [{ action: 'changeLineItemQuantity', lineItemId: lineId, quantity }];
  });
  return finish(session, market, ct);
}

/** Removes a line. An empty cart is still the shopper's cart: the session keeps its `cartId`. */
export async function removeLine(session: Session, market: CartMarket, lineId: string): Promise<CartView> {
  const ct = await mutateCart(session, (current) => {
    lineOrThrow(current, lineId);
    return [{ action: 'removeLineItem', lineItemId: lineId }];
  });
  return finish(session, market, ct);
}

function planLines(cart: Cart): PlanLine[] {
  return cart.lineItems.map((l) => ({
    id: l.id,
    sku: l.variant?.sku ?? '',
    quantity: l.quantity,
    fulfilment: fulfilmentOf(l),
    ...(l.supplyChannel ? { channelId: l.supplyChannel.id } : {}),
    subscribe: Boolean(l.recurrenceInfo) || fulfilmentOf(l) === 'subscribe',
  }));
}

/** Plan steps to commercetools update actions. `set` does not merge on its own, hence the explicit `merge` steps. */
export function opsToActions(ops: PlanOp[]): CartUpdateAction[] {
  return ops.flatMap((op): CartUpdateAction[] =>
    op.kind === 'set'
      ? [
          // No `supplyChannel` field removes the channel (verified in I-00).
          { action: 'setLineItemSupplyChannel', lineItemId: op.lineId, ...(op.channelId ? { supplyChannel: { typeId: 'channel' as const, id: op.channelId } } : {}) },
          { action: 'setLineItemCustomField', lineItemId: op.lineId, name: 'fulfilment', value: op.fulfilment },
        ]
      : [
          { action: 'changeLineItemQuantity', lineItemId: op.keepId, quantity: op.quantity },
          { action: 'removeLineItem', lineItemId: op.removeId },
        ],
  );
}

export type SwitchInput = { fulfilment: 'delivery' } | { fulfilment: 'collect'; storeKey?: string };

/** The store (channel) a collect action targets: validated against the market and the session's choice. */
async function resolveStore(cart: Cart, market: CartMarket, session: Session, storeKey: string | undefined) {
  const country = cart.country ?? market.country;
  if (!marketForCountry(country)?.collection) throw new LineRejected('collect_not_available_in_market', 400);
  const key = storeKey ?? session.collectionStoreKey;
  if (!key) throw new LineRejected('store_required', 409);
  const store = (await getStoresForCountry(country, market.locale)).find((s) => s.key === key);
  if (!store) throw new LineRejected('unknown_store', 400);
  return store;
}

/**
 * Switches one line between delivery and collect. A twin (same SKU, target fulfilment and channel) absorbs the line in ONE
 * update (quantity change plus remove). Collect needs a store (`store_required` when none is given or chosen), a market that
 * offers collection and enough stock at the store. Subscribe lines are not switchable.
 */
export async function switchFulfilment(session: Session, market: CartMarket, lineId: string, input: SwitchInput): Promise<CartView> {
  const ct = await mutateCart(session, async (current) => {
    lineOrThrow(current, lineId);
    const store = input.fulfilment === 'collect' ? await resolveStore(current, market, session, input.storeKey) : undefined;
    const plan = planFulfilmentSwitch(planLines(current), lineId, store ? { fulfilment: 'collect', channelId: store.id } : { fulfilment: 'delivery' });
    if (plan.kind === 'reject') throw new LineRejected(plan.reason, plan.reason === 'line_not_found' ? 404 : 422);
    if (plan.kind === 'noop') return [];
    if (store) {
      const sku = lineOrThrow(current, lineId).variant?.sku ?? '';
      const available = await getStoreStock(sku, store.id);
      if (available < plan.resultingQuantity) throw new LineRejected('not_available_for_collection', 409, { available });
    }
    return opsToActions(plan.ops);
  });
  return finish(session, market, ct);
}

/**
 * Moves every collect line to another store, merging duplicates. Lines the new store cannot cover still move and carry the
 * `collect-unavailable` flag (the shopper then switches them to delivery).
 */
export async function changeCollectionStore(session: Session, market: CartMarket, storeKey: string): Promise<CartView> {
  const ct = await mutateCart(session, async (current) => {
    const store = await resolveStore(current, market, session, storeKey);
    return opsToActions(planStoreChange(planLines(current), store.id));
  });
  return finish(session, market, ct);
}

/** A discount code commercetools refused (`DiscountCodeNonApplicable`), with its reason. Never carries the code text. */
export class CodeRejected extends Error {
  constructor(readonly reason: CodeRejectionReason) {
    super('code_not_applied');
    this.name = 'CodeRejected';
  }
}

function codeRejection(e: unknown): CodeRejected | null {
  const first = (e as CtErrorLike)?.body?.errors?.[0] as { code?: string; reason?: string } | undefined;
  if (first?.code !== 'DiscountCodeNonApplicable') return null;
  return new CodeRejected(isCodeRejectionReason(first.reason) ? first.reason : 'DoesNotExist');
}

/** `addDiscountCode`. A refused code throws `CodeRejected` and leaves the cart as it was. The code text is never logged. */
export async function applyDiscountCode(session: Session, market: CartMarket, code: string): Promise<CartView> {
  try {
    const ct = await mutateCart(session, () => [{ action: 'addDiscountCode', code }]);
    return await finish(session, market, ct);
  } catch (e) {
    throw codeRejection(e) ?? e;
  }
}

export async function removeDiscountCode(session: Session, market: CartMarket, id: string): Promise<CartView> {
  const ct = await mutateCart(session, () => [{ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id } }]);
  return finish(session, market, ct);
}

/** The view after a refused code: the cart exactly as the engine has it. */
export async function currentCartView(session: Session, market: CartMarket): Promise<CartView> {
  const ct = await readOwnedCart(session);
  if (!ct) throw new AppError('not_found', 404);
  return viewOf(ct, session, market);
}

export interface RebuildTarget { country: string; currency: string; locale: string; shippingMode?: 'Single' | 'Multiple' }
export interface RebuildResult {
  /** The session with the new `cartId`. */
  session: Session;
  /** Lines that could not move; nothing is dropped silently. */
  dropped: DroppedLine[];
  /** Codes that were valid in the old bag and were refused in the new market. Not shown to the shopper. */
  droppedCodes: string[];
}

/**
 * Region switch and shipping-mode migration (3.10): a new cart in the target market (currency and mode are fixed at creation),
 * then every old line through `addLine`, then the old codes. Collect lines keep their store only when the store is in the new
 * country and still has the stock, otherwise they become delivery lines. Subscribe lines need a recurring price in the new
 * market. The old cart is left to expire in one day.
 */
export async function rebuildCart(session: Session, oldCart: Cart, target: RebuildTarget): Promise<RebuildResult> {
  const market: CartMarket = { country: target.country, currency: target.currency, locale: target.locale };
  const created = await createRawCart(withoutCart(session), market, target.shippingMode ?? CART_SHIPPING_MODE);
  let next = created.session;
  const dropped: DroppedLine[] = [];

  const [oldStores, newStores, policies] = await Promise.all([
    getStoresForCountry(oldCart.country ?? target.country, target.locale).catch(() => []),
    getStoresForCountry(target.country, target.locale).catch(() => []),
    getRecurrencePolicies(target.locale).catch(() => []),
  ]);
  const collectionOffered = Boolean(marketForCountry(target.country)?.collection);

  for (const line of oldCart.lineItems) {
    const sku = line.variant?.sku ?? '';
    const name = getLocalizedString(line.name, target.locale);
    const fulfilment = fulfilmentOf(line);
    const attempts: AddLineInput[] = [];
    if (fulfilment === 'subscribe') {
      const policy = policies.find((p) => p.id === line.recurrenceInfo?.recurrencePolicy?.id);
      if (!policy) {
        dropped.push({ sku, name, reason: 'unknown' });
        continue;
      }
      attempts.push({ sku, quantity: line.quantity, fulfilment: 'subscribe', recurrencePolicyKey: policy.key });
    } else {
      if (fulfilment === 'collect' && collectionOffered) {
        const oldStore = oldStores.find((s) => s.id === line.supplyChannel?.id);
        const store = oldStore && newStores.find((s) => s.key === oldStore.key);
        if (store) attempts.push({ sku, quantity: line.quantity, fulfilment: 'collect', storeKey: store.key });
      }
      attempts.push({ sku, quantity: line.quantity, fulfilment: 'delivery' });
    }
    for (const input of attempts) {
      try {
        next = (await addLine(next, market, input)).session;
        break;
      } catch (e) {
        if (e instanceof LineRejected && input.fulfilment === 'collect') continue; // try delivery instead
        const reason = rebuildReason(e);
        if (!reason) throw e;
        dropped.push({ sku, name, reason });
        break;
      }
    }
  }

  const droppedCodes = await reapplyCodes(next, oldCart);
  await markForDeletion(oldCart);
  return { session: next, dropped, droppedCodes };
}

function rebuildReason(e: unknown): DroppedLine['reason'] | null {
  if (e instanceof LineRejected) return e.code === 'price_unavailable' ? 'no-price' : 'unknown';
  if (e instanceof AppError) return e.code === 'validation_failed' ? 'no-price' : e.code === 'not_found' ? 'unknown' : null;
  return null;
}

async function reapplyCodes(session: Session, oldCart: Cart): Promise<string[]> {
  const lost: string[] = [];
  for (const info of oldCart.discountCodes ?? []) {
    const code = info.discountCode.obj?.code;
    if (!code) continue;
    try {
      await mutateCart(session, () => [{ action: 'addDiscountCode', code }]);
    } catch (e) {
      if (codeRejection(e) !== null && info.state === 'MatchesCart') lost.push(code);
    }
  }
  return lost;
}

async function markForDeletion(old: Cart): Promise<void> {
  try {
    await postUpdate(old.id, old.version, [{ action: 'setDeleteDaysAfterLastModification', deleteDaysAfterLastModification: 1 }]);
  } catch {
    // Best effort: the old cart then expires after its normal 30 days.
  }
}

/** The raw owned cart for the market switch (it needs lines and codes), or null. */
export async function getOwnedCartForRebuild(session: Session): Promise<Cart | null> {
  return readOwnedCart(session);
}
