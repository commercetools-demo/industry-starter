// Throwaway priced carts. The engine prices the cart, we read the answer, and the cart is always deleted: the discount prompts and the
// finder's price preview both go through here so the cleanup guarantee lives in one place.
import type { Cart as CtCart, CartDraft } from '@commercetools/platform-sdk';
import { PROBE_CART_KEY_PREFIX } from '@/lib/config/cart';
import { createProbeCart, deleteCart } from './cart';

/** A key that marks a cart as a probe (a leak sweep finds them by this prefix). */
export const probeKey = (): string => `${PROBE_CART_KEY_PREFIX}${crypto.randomUUID()}`;

/**
 * Creates the probe cart from `draft`, hands the priced cart to `read`, and deletes it in `finally` whatever `read` does.
 * A failed delete is logged (the cart also expires on its own through `deleteDaysAfterLastModification`), never thrown over the answer.
 */
export async function withProbeCart<T>(draft: CartDraft, read: (probe: CtCart) => T | Promise<T>): Promise<T> {
  const probe = await createProbeCart(draft);
  try {
    return await read(probe);
  } finally {
    await deleteCart(probe).catch((error: unknown) => console.error('[probe] cart not deleted (it expires on its own)', probe.id, error));
  }
}
