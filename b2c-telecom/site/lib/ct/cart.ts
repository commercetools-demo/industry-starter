import 'server-only';
import type { Cart as CtCart, CartDraft, CartUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api-error';
import { CART_DELETE_DAYS } from '@/lib/config/cart';
import type { SessionData } from '@/lib/session-types';
import type { Market } from '@/lib/types';
import { getApiRoot } from './client';
import { ensureAnonymousId } from './identity';
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
