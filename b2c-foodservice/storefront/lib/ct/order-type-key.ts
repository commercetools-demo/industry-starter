import 'server-only';
import type { Cart } from '@commercetools/platform-sdk';
import { isInstore } from '@/lib/app-mode';

/** Key of the custom type that marks a cart as made in the In-store companion (D-042). */
export const ORDER_TYPE_KEY = 'instore-order-type';

/**
 * True when the website must not treat this cart as the shopper's: it carries the `instore-order-type` custom type and this deploy
 * is not the In-store companion (which makes those carts itself). Needs the cart read with `expand=custom.type`; a cart read without
 * the expansion has no key to compare and is never hidden.
 */
export function isHiddenInstoreCart(cart: Pick<Cart, 'custom'>): boolean {
  return !isInstore() && cart.custom?.type?.obj?.key === ORDER_TYPE_KEY;
}
