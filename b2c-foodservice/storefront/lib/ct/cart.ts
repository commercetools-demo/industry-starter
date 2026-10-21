import 'server-only';
import type { Cart, CartAddLineItemAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getStoreStock } from '@/lib/ct/inventory';
import { getProductBySku, getRecurrencePolicyByKey } from '@/lib/ct/product-detail';
import { updateWithRetry } from '@/lib/ct/retry';
import type { DomainErrorCode } from '@/lib/api-domain';
import { AppError } from '@/lib/errors';
import { mapCartSummary } from '@/lib/mappers/cart';
import { ensureAnonymousId, type Session } from '@/lib/session';
import { CART_SHIPPING_MODE } from '@/lib/shop-config';
import type { CartSummary } from '@/lib/types';
import { marketForCountry } from '@/lib/utils';

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

async function createRawCart(session: Session, market: CartMarket): Promise<{ cart: Cart; session: Session }> {
  const next = session.customerId ? session : ensureAnonymousId(session);
  const { body } = await apiRoot
    .carts()
    .post({
      body: {
        currency: market.currency,
        country: market.country,
        locale: market.locale,
        shippingMode: CART_SHIPPING_MODE,
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
  const subscribable = projection.attributes?.find((a) => a.name === 'subscribable')?.value === true;
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
