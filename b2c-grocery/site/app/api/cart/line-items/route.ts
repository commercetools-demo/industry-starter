import { cartFailure, cartJson, isValidQuantity, jsonError, readJson } from '@/lib/cart-api';
import { defaultSubstitutionPreference, categoryKeysOf } from '@/lib/config/substitution';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { addLineItem, createCart, getCart, withCartRetry } from '@/lib/ct/cart';
import { getCategoryTree } from '@/lib/ct/categories';
import { getProductBySku } from '@/lib/ct/search';
import { getMarket, getSession } from '@/lib/session';

/**
 * Add a line. Carts use inventory mode None (D-031), so this route is the stock guard: existing quantity plus the
 * requested quantity must not exceed the available quantity, else 409 with the maximum.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const { sku, quantity, recurrencePolicyKey } = body;
  if (typeof sku !== 'string' || sku === '') return jsonError('INVALID_SKU', 400);
  if (!isValidQuantity(quantity)) return jsonError('INVALID_QUANTITY', 400);
  if (recurrencePolicyKey !== undefined && typeof recurrencePolicyKey !== 'string') return jsonError('INVALID_RECURRENCE', 400);

  try {
    const session = await getSession();
    const market = await getMarket();
    const product = await getProductBySku(sku, market);
    if (!product) return jsonError('UNKNOWN_SKU', 404);

    const existing = session.cartId ? await getCart(session.cartId) : null;
    const inCart = existing?.lineItems.find((l) => l.variant.sku === sku)?.quantity ?? 0;
    const available = await getAvailableQuantity(sku);
    if (inCart + quantity > available) return jsonError('INSUFFICIENT_STOCK', 409, { available });

    const substitutionPreference = defaultSubstitutionPreference(product, categoryKeysOf(product, await getCategoryTree(market.locale)));
    const input = { sku, quantity, substitutionPreference, ...(recurrencePolicyKey ? { recurrencePolicyKey } : {}) };

    const cart = existing
      ? await withCartRetry(existing.id, (c) => addLineItem(c.id, c.version, input))
      : await (async () => {
          const created = await createCart({ ...session, ...market });
          return addLineItem(created.id, created.version, input);
        })();
    // A new anonymous cart carries its anonymousId into the session so the visitor keeps it.
    return await cartJson(cart, market, cart.anonymousId && !cart.customerId ? { anonymousId: cart.anonymousId } : {});
  } catch (e) {
    return cartFailure(e);
  }
}
