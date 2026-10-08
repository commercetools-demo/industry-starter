import 'server-only';
import { getSession, setCart, clearCart } from '@/lib/session';
import type { Cart, CartSummary } from '@/lib/types';

/** Shared by the cart Route Handlers: keeps the session's `cartId` equal to the customer's cart. */
export async function syncCartSession(cart: Pick<Cart, 'id'> | null): Promise<void> {
  const { cartId } = await getSession();
  if (cart && cart.id !== cartId) await setCart(cart.id);
  if (!cart && cartId) await clearCart();
}

/** The part of a cart the header needs. */
export function toSummary(cart: Cart): CartSummary {
  return { id: cart.id, version: cart.version, itemCount: cart.itemCount, lineCount: cart.lineCount, currencyCode: cart.currencyCode };
}
