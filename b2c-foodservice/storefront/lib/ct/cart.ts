import 'server-only';
import { apiRoot } from '@/lib/ct/client';

/**
 * Units in the cart (sum of line quantities, not lines), or null when the cart is gone or no longer Active
 * (ordered, merged or deleted). Workstreams G and I extend this file with the rest of the cart reads and writes.
 */
export async function getCartUnitCount(cartId: string): Promise<number | null> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
    if (body.cartState !== 'Active') return null;
    return body.totalLineItemQuantity ?? body.lineItems.reduce((n, l) => n + l.quantity, 0);
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}
