import 'server-only';
import type { Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import { mapCart } from '../mappers/cart';
import type { Cart, SubstitutionPreference } from '../types';
import type { Session } from '../session';
import { getApiRoot } from './client';
import { newCartDraft } from './cart-defaults';

/** Expand the recurrence policy so the mapper can expose its key (used by subscriptions, W). */
const EXPAND = ['lineItems[*].recurrenceInfo.recurrencePolicy'];

export class CartNotActiveError extends Error {
  constructor(cartId: string) {
    super(`Cart ${cartId} is not active`);
    this.name = 'CartNotActiveError';
  }
}

const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};

/** The cart, or `null` when it does not exist or is no longer `Active` (ordered, merged or deleted). */
export async function getCart(id: string): Promise<CtCart | null> {
  try {
    const { body } = await getApiRoot().carts().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute();
    return body.cartState === 'Active' ? body : null;
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
}

/** Server-side convenience for layouts and routes: the Active cart mapped for the shopper's market, else `null`. */
export async function getMappedCart(id: string, ctx: { locale: string; currency: string; country: string }): Promise<Cart | null> {
  const cart = await getCart(id);
  return cart ? mapCart(cart, ctx) : null;
}

/** A new cart: inventory None, platform tax, the session market. Anonymous visitors get an `anonymousId`. */
export async function createCart(session: Session & { currency: string; country: string; locale: string }): Promise<CtCart> {
  const draft = newCartDraft(session);
  const body = !draft.customerId && !draft.anonymousId ? { ...draft, anonymousId: crypto.randomUUID() } : draft;
  const res = await getApiRoot().carts().post({ body }).execute();
  return res.body;
}

export async function updateCart(cartId: string, version: number, actions: CartUpdateAction[]): Promise<CtCart> {
  const { body } = await getApiRoot()
    .carts()
    .withId({ ID: cartId })
    .post({ body: { version, actions }, queryArgs: { expand: EXPAND } })
    .execute();
  return body;
}

export interface AddLineItemInput {
  sku: string;
  quantity: number;
  recurrencePolicyKey?: string;
  substitutionPreference: SubstitutionPreference;
}

export function addLineItem(cartId: string, version: number, input: AddLineItemInput): Promise<CtCart> {
  return updateCart(cartId, version, [
    {
      action: 'addLineItem',
      sku: input.sku,
      quantity: input.quantity,
      custom: {
        type: { key: 'line-substitution', typeId: 'type' },
        fields: { substitutionPreference: input.substitutionPreference },
      },
      // Dynamic is required by commercetools and is what the buyer is told at setup (D-034).
      ...(input.recurrencePolicyKey
        ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy' as const, key: input.recurrencePolicyKey }, priceSelectionMode: 'Dynamic' } }
        : {}),
    },
  ]);
}

export function changeLineItemQuantity(cartId: string, version: number, lineItemId: string, quantity: number): Promise<CtCart> {
  return updateCart(cartId, version, [{ action: 'changeLineItemQuantity', lineItemId, quantity }]);
}

export function removeLineItem(cartId: string, version: number, lineItemId: string): Promise<CtCart> {
  return updateCart(cartId, version, [{ action: 'removeLineItem', lineItemId }]);
}

/**
 * Runs `fn` with a fresh cart. On a 409 `ConcurrentModification` it re-fetches the cart and retries exactly once;
 * a second 409 propagates. Throws `CartNotActiveError` when the cart is gone or no longer Active.
 */
export async function withCartRetry(cartId: string, fn: (cart: CtCart) => Promise<CtCart>): Promise<CtCart> {
  for (let attempt = 0; ; attempt++) {
    const cart = await getCart(cartId);
    if (!cart) throw new CartNotActiveError(cartId);
    try {
      return await fn(cart);
    } catch (e) {
      if (statusOf(e) !== 409 || attempt >= 1) throw e;
    }
  }
}
