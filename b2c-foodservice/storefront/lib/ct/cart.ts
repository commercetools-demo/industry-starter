import 'server-only';
import type { Cart } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { mapCartSummary } from '@/lib/mappers/cart';
import { ensureAnonymousId, type Session } from '@/lib/session';
import { CART_SHIPPING_MODE } from '@/lib/shop-config';
import type { CartSummary } from '@/lib/types';

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

export async function addLine(
  session: Session,
  market: CartMarket,
  input: AddLineInput,
): Promise<{ cart: CartSummary; session: Session }> {
  if (input.fulfilment !== 'delivery') throw new AppError('bad_request', 501);
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
        (
          await apiRoot
            .carts()
            .withId({ ID: cartId })
            .post({
              body: {
                version: current.version,
                actions: [
                  {
                    action: 'addLineItem',
                    sku: input.sku,
                    quantity: input.quantity,
                    custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'delivery' } },
                  },
                ],
              },
            })
            .execute()
        ).body,
    );
    return { cart: mapCartSummary(updated), session: next };
  } catch (e) {
    throw toLineError(e);
  }
}
