import 'server-only';
import type { CartLineRef } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode: unknown }).statusCode === 404;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * Read-only view of the cart's lines for the offer rules. `cartId` always comes from the session, never from a request body.
 * A missing or non-Active cart reads as no cart. No writes, no caching (session-specific).
 */
export async function getCartLineRefs(cartId: string): Promise<CartLineRef[]> {
  try {
    const { body } = await withTimeout(getApiRoot().carts().withId({ ID: cartId }).get().execute(), 'cart-context.read');
    if (body.cartState !== 'Active') return [];
    return body.lineItems.map((line) => {
      const fields = line.custom?.fields as Record<string, unknown> | undefined;
      const parentLineItemId = text(fields?.parentLineItemId);
      return {
        lineItemId: line.id,
        offerKey: text(fields?.offerKey) ?? line.productKey ?? '',
        ...(parentLineItemId === undefined ? {} : { parentLineItemId }),
        quantity: line.quantity,
      };
    });
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
