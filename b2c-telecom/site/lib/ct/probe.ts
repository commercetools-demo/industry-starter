// Throwaway priced carts. The engine prices the cart, we read the answer, and the cart is always deleted: the discount prompts and the
// finder's price preview both go through here so the cleanup guarantee lives in one place.
import type { Cart as CtCart, CartDraft, CartUpdateAction } from '@commercetools/platform-sdk';
import { PROBE_CART_KEY_PREFIX } from '@/lib/config/cart';
import { createProbeCart, deleteCart, updateCart } from './cart';

/** A key that marks a cart as a probe (a leak sweep finds them by its prefix). */
export const probeKey = (prefix: string = PROBE_CART_KEY_PREFIX): string => `${prefix}${crypto.randomUUID()}`;

export interface ProbeTools {
  /** One update of the probe (child lines need the id of the line they belong to, which exists only after the first write). */
  update: (actions: CartUpdateAction[]) => Promise<CtCart>;
}

/**
 * Creates the probe cart from `draft`, hands the priced cart to `read`, and deletes it in `finally` whatever `read` does (with the version
 * the last update left, so a probe that was updated is still deleted). A failed delete is logged (the cart also expires on its own through
 * `deleteDaysAfterLastModification`), never thrown over the answer.
 */
export async function withProbeCart<T>(draft: CartDraft, read: (probe: CtCart, tools: ProbeTools) => T | Promise<T>): Promise<T> {
  let current = await createProbeCart(draft);
  try {
    return await read(current, {
      update: async (actions) => {
        current = await updateCart(current, actions);
        return current;
      },
    });
  } finally {
    const last = current;
    await deleteCart(last).catch((error: unknown) => console.error('[probe] cart not deleted (it expires on its own)', last.id, error));
  }
}
