import 'server-only';
import type { ShoppingList, ShoppingListUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { ownsCart } from '@/lib/ct/cart';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { isProductId } from '@/lib/reviews/validate';
import type { Session } from '@/lib/session';

/** A list holds at most this many lines (commercetools' own limit); one more is `409 list_full`. */
export const MAX_LIST_LINES = 250;

export class ListFullError extends Error {
  constructor() {
    super('list_full');
    this.name = 'ListFullError';
  }
}

const NAME = { 'en-US': 'Saved items', 'en-CA': 'Saved items' };

/**
 * The customer's default list (one per customer, the B2C wishlist pattern): found by customer, never by a client id. The
 * owner is checked after the read (`list.customer.id === customerId`, else null). A list has no `store` field.
 */
export async function findList(customerId: string): Promise<ShoppingList | null> {
  const { body } = await apiRoot
    .shoppingLists()
    .get({ queryArgs: { where: 'customer(id=:c)', 'var.c': customerId, expand: ['lineItems[*].variant'], limit: 1 } })
    .execute();
  const list = body.results[0];
  return list && list.customer?.id === customerId ? list : null;
}

/** Creates the list on first use. A second request racing the first finds the key taken and reads the winner. */
export async function ensureList(customerId: string): Promise<ShoppingList> {
  const existing = await findList(customerId);
  if (existing) return existing;
  try {
    const { body } = await apiRoot
      .shoppingLists()
      .post({ body: { name: NAME, key: `mcf-saved-${customerId}`, customer: { typeId: 'customer', id: customerId } } })
      .execute();
    return body;
  } catch (e) {
    const found = await findList(customerId);
    if (found) return found;
    throw e;
  }
}

const readById = async (id: string): Promise<ShoppingList> => (await apiRoot.shoppingLists().withId({ ID: id }).get().execute()).body;

async function update(customerId: string, build: (list: ShoppingList) => ShoppingListUpdateAction[]): Promise<ShoppingList> {
  const first = await ensureList(customerId);
  return updateWithRetry(
    async () => {
      const list = await readById(first.id);
      if (list.customer?.id !== customerId) throw new AppError('not_found', 404);
      return list;
    },
    async (current) => {
      const actions = build(current);
      if (actions.length === 0) return current;
      return (await apiRoot.shoppingLists().withId({ ID: current.id }).post({ body: { version: current.version, actions } }).execute()).body;
    },
  );
}

export interface SaveRequest { productId: string; variantId?: number }

/** Adds products (duplicates ignored: a product already in the list is not added again). Over 250 lines is `ListFullError`. */
export async function addProducts(customerId: string, requests: SaveRequest[]): Promise<ShoppingList> {
  return update(customerId, (list) => {
    const have = new Set(list.lineItems.map((l) => l.productId));
    const fresh: SaveRequest[] = [];
    for (const r of requests) {
      if (!isProductId(r.productId) || have.has(r.productId)) continue;
      have.add(r.productId);
      fresh.push(r);
    }
    if (list.lineItems.length + fresh.length > MAX_LIST_LINES) throw new ListFullError();
    return fresh.map(
      (r): ShoppingListUpdateAction => ({
        action: 'addLineItem',
        productId: r.productId,
        ...(r.variantId !== undefined ? { variantId: r.variantId } : {}),
        quantity: 1,
      }),
    );
  });
}

/** Removes every line of the product. A product that is not in the list changes nothing. */
export async function removeProduct(customerId: string, productId: string): Promise<ShoppingList> {
  return update(customerId, (list) =>
    list.lineItems.filter((l) => l.productId === productId).map((l): ShoppingListUpdateAction => ({ action: 'removeLineItem', lineItemId: l.id })),
  );
}

/** Product ids of the lines in the session's bag (a bag of someone else's is "no bag"). Used to create a list from the bag. */
export async function cartProductIds(session: Session): Promise<string[]> {
  if (!session.cartId) return [];
  try {
    const { body } = await apiRoot.carts().withId({ ID: session.cartId }).get().execute();
    if (body.cartState !== 'Active' || !ownsCart(body, session)) return [];
    return [...new Set(body.lineItems.map((l) => l.productId))];
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return [];
    throw e;
  }
}
