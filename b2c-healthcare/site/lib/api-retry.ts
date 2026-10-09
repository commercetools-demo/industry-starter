import 'server-only';

function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { statusCode?: unknown; status?: unknown };
  return e.statusCode === 409 || e.status === 409;
}

/**
 * Cart mutation with one retry on a version conflict (409). `fn` must read the CURRENT cart
 * (id and version) itself and then apply the update, so the second attempt works on the refetched
 * version:
 *
 *   withCartRetry(async () => {
 *     const cart = await getCartForUpdate(cartId); // refetch inside
 *     return updateCart(cart.id, cart.version, actions);
 *   });
 *
 * Any other error, and a second 409, is rethrown for the Route Handler's `handle()` to sanitize.
 */
export async function withCartRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isVersionConflict(error)) throw error;
    return fn();
  }
}
