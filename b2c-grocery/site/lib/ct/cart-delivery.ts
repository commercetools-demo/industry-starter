import 'server-only';
import type { BaseAddress, Cart as CtCart, CartUpdateAction } from '@commercetools/platform-sdk';
import type { Address, CartSlot } from '../types';
import { getApiRoot } from './client';
import { updateCart, withCartRetry } from './cart';

export const CART_DELIVERY_TYPE_KEY = 'cart-delivery';
export const SHIPPING_METHOD_KEY = 'standard';
/** Custom fields of the `cart-delivery` type (F-05), in write order. */
const SLOT_FIELDS = ['slotId', 'slotStart', 'slotEnd', 'slotHoldExpires'] as const;

/** Raised when the `standard` shipping method does not match the cart (wrong country or no zone). */
export class ShippingMethodUnavailableError extends Error {
  constructor(cartId: string) {
    super(`No applicable "${SHIPPING_METHOD_KEY}" shipping method for cart ${cartId}`);
    this.name = 'ShippingMethodUnavailableError';
  }
}

const toBaseAddress = (a: Address): BaseAddress => ({
  country: a.country,
  ...(a.firstName ? { firstName: a.firstName } : {}),
  ...(a.lastName ? { lastName: a.lastName } : {}),
  ...(a.streetName ? { streetName: a.streetName } : {}),
  ...(a.additionalStreetInfo ? { additionalStreetInfo: a.additionalStreetInfo } : {}),
  ...(a.postalCode ? { postalCode: a.postalCode } : {}),
  ...(a.city ? { city: a.city } : {}),
  ...(a.phone ? { phone: a.phone } : {}),
  ...(a.email ? { email: a.email } : {}),
});

export function setShippingAddress(cartId: string, address: Address): Promise<CtCart> {
  return withCartRetry(cartId, (cart) =>
    updateCart(cart.id, cart.version, [{ action: 'setShippingAddress', address: toBaseAddress(address) }]),
  );
}

const presentSlotFields = (cart: CtCart): string[] => {
  const fields: Record<string, unknown> = cart.custom?.fields ?? {};
  return SLOT_FIELDS.filter((name) => fields[name] !== undefined);
};

/**
 * Removing a field that is not set is a 400 `InvalidOperation` (verified live), so only present fields are removed.
 * Nothing to remove: no commercetools call.
 */
export function clearSlot(cartId: string): Promise<CtCart> {
  return withCartRetry(cartId, async (cart) => {
    const actions: CartUpdateAction[] = presentSlotFields(cart).map((name) => ({ action: 'setCustomField', name }));
    return actions.length === 0 ? cart : updateCart(cart.id, cart.version, actions);
  });
}

/**
 * Writes the slot into the `cart-delivery` custom fields. `setCustomType` is only sent when the cart has no custom type:
 * re-applying it would reset every field (verified live). `null` clears the slot.
 */
export function setSlot(cartId: string, slot: CartSlot | null): Promise<CtCart> {
  if (slot === null) return clearSlot(cartId);
  return withCartRetry(cartId, (cart) => {
    const actions: CartUpdateAction[] = [];
    if (!cart.custom) actions.push({ action: 'setCustomType', type: { typeId: 'type', key: CART_DELIVERY_TYPE_KEY } });
    const values: Record<(typeof SLOT_FIELDS)[number], string | undefined> = {
      slotId: slot.id,
      slotStart: slot.start,
      slotEnd: slot.end,
      slotHoldExpires: slot.holdExpires,
    };
    const existing = cart.custom?.fields ?? {};
    for (const name of SLOT_FIELDS) {
      const value = values[name];
      if (value !== undefined) actions.push({ action: 'setCustomField', name, value });
      else if (existing[name] !== undefined) actions.push({ action: 'setCustomField', name });
    }
    return updateCart(cart.id, cart.version, actions);
  });
}

/**
 * Sets the `standard` shipping method (D-049: the older 500.00 methods stay active, so it must be explicit) so the
 * cart totals include delivery and the free-above threshold of the rate. No-op when it is already selected.
 */
export function ensureShippingMethod(cartId: string): Promise<CtCart> {
  return withCartRetry(cartId, async (cart) => {
    const { body } = await getApiRoot().shippingMethods().matchingCart().get({ queryArgs: { cartId: cart.id } }).execute();
    const standard = body.results.find((m) => m.key === SHIPPING_METHOD_KEY);
    if (!standard) throw new ShippingMethodUnavailableError(cart.id);
    if (cart.shippingInfo?.shippingMethod?.id === standard.id) return cart;
    return updateCart(cart.id, cart.version, [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', id: standard.id } }]);
  });
}
