import { isDeliverable } from './slots/deliverable';
import type { Cart, CartSlot } from './types';

/** A slot counts while its hold has not expired (a slot without hold info is treated as active). */
export function isSlotActive(slot: CartSlot | undefined, now: Date = new Date()): slot is CartSlot {
  if (!slot) return false;
  if (!slot.holdExpires) return true;
  const expires = Date.parse(slot.holdExpires);
  return Number.isNaN(expires) || expires > now.getTime();
}

export type CheckoutBlock = 'EMPTY' | 'OUT_OF_STOCK' | 'NO_ADDRESS' | 'UNDELIVERABLE' | 'NO_SLOT';

/** Why the bag cannot go to checkout yet, in the order the shopper should fix things; `null` when it can. */
export function checkoutBlock(cart: Cart, now: Date = new Date()): CheckoutBlock | null {
  if (cart.lines.length === 0) return 'EMPTY';
  if (cart.lines.some((l) => !l.inStock)) return 'OUT_OF_STOCK';
  const address = cart.shippingAddress;
  if (!address?.postalCode) return 'NO_ADDRESS';
  if (!isDeliverable(address.country, address.postalCode)) return 'UNDELIVERABLE';
  if (!isSlotActive(cart.slot, now)) return 'NO_SLOT';
  return null;
}

/** Checkout needs lines that are all in stock, a deliverable address and a slot whose hold is still running. */
export const canCheckout = (cart: Cart, now: Date = new Date()): boolean => checkoutBlock(cart, now) === null;
