import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { clearCart } from '@/lib/session';
import type { CartSummary } from '@/lib/types';

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: unknown } | null;
  return typeof e?.statusCode === 'number' ? e.statusCode : undefined;
}

/**
 * Reads the cart for first paint. A cart that is missing or not Active is tolerated: the session's
 * `cartId` is cleared (best effort: cookies are writable only in Route Handlers and Server Actions,
 * so in a Server Component render the clear is skipped and the cart endpoint clears it later) and
 * `null` is returned so the page still renders. Other failures also return null without clearing.
 * Never cached: it receives a cartId.
 */
export async function getActiveCartSafe(cartId: string): Promise<CartSummary | null> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
    if (body.cartState === 'Active') {
      return {
        id: body.id,
        version: body.version,
        itemCount: body.lineItems.reduce((sum, item) => sum + item.quantity, 0),
        lineCount: body.lineItems.length,
        currencyCode: body.totalPrice.currencyCode,
      };
    }
  } catch (error) {
    const status = statusOf(error);
    if (status !== 404) {
      console.error('[cart] could not read cart', error instanceof Error ? error.name : typeof error, status ?? '');
      return null;
    }
  }
  try {
    await clearCart();
  } catch {
    // Cookies are read-only during a Server Component render; the cart endpoint clears it.
  }
  return null;
}
