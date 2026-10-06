import 'server-only';
import type { ShoppingList, ShoppingListUpdateAction } from '@commercetools/platform-sdk';
import type { Product } from '../types';
import { getApiRoot } from './client';
import { getProductsByIds, type Ctx } from './search';

/** One list per customer, addressed by key so a query never needs `where` (and never touches another customer's list). */
export const wishlistKey = (customerId: string): string => `wishlist-${customerId}`;

const WISHLIST_NAME = { 'en-US': 'Saved', 'de-DE': 'Gemerkt' };

const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};

/** The customer's wishlist, or `null` when it was never created. */
export async function getWishlist(customerId: string): Promise<ShoppingList | null> {
  try {
    const { body } = await getApiRoot().shoppingLists().withKey({ key: wishlistKey(customerId) }).get().execute();
    return body;
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
}

/** Creates the list on first use. Two simultaneous first saves: the loser gets a duplicate-key 400 and reads the winner's list. */
export async function getOrCreateWishlist(customerId: string): Promise<ShoppingList> {
  const existing = await getWishlist(customerId);
  if (existing) return existing;
  try {
    const { body } = await getApiRoot()
      .shoppingLists()
      .post({ body: { key: wishlistKey(customerId), name: WISHLIST_NAME, customer: { typeId: 'customer', id: customerId } } })
      .execute();
    return body;
  } catch (e) {
    if (statusOf(e) === 400) {
      const raced = await getWishlist(customerId);
      if (raced) return raced;
    }
    throw e;
  }
}

async function update(listId: string, version: number, actions: ShoppingListUpdateAction[]): Promise<ShoppingList> {
  const { body } = await getApiRoot().shoppingLists().withId({ ID: listId }).post({ body: { version, actions } }).execute();
  return body;
}

/** Product ids on the list, newest first. */
export const productIdsOf = (list: Pick<ShoppingList, 'lineItems'>): string[] =>
  [...list.lineItems]
    .reverse()
    .map((line) => line.productId)
    .filter((id, i, all) => all.indexOf(id) === i);

/** Adds a line item by `productId`; nothing is sent when the product is already on the list. */
export async function addProduct(list: ShoppingList, productId: string): Promise<ShoppingList> {
  if (list.lineItems.some((line) => line.productId === productId)) return list;
  return update(list.id, list.version, [{ action: 'addLineItem', productId, quantity: 1 }]);
}

/** Removes every line item of the product (by line item id); nothing is sent when it is not on the list. */
export async function removeProduct(list: ShoppingList, productId: string): Promise<ShoppingList> {
  const lines = list.lineItems.filter((line) => line.productId === productId);
  if (lines.length === 0) return list;
  return update(
    list.id,
    list.version,
    lines.map((line) => ({ action: 'removeLineItem' as const, lineItemId: line.id })),
  );
}

/** Runs `fn` on the current list; one retry on a version conflict (409) with a fresh read. */
async function withWishlist(customerId: string, fn: (list: ShoppingList) => Promise<ShoppingList>): Promise<ShoppingList> {
  try {
    return await fn(await getOrCreateWishlist(customerId));
  } catch (e) {
    if (statusOf(e) !== 409) throw e;
    return fn(await getOrCreateWishlist(customerId));
  }
}

export const saveProduct = (customerId: string, productId: string): Promise<ShoppingList> => withWishlist(customerId, (list) => addProduct(list, productId));
export const unsaveProduct = (customerId: string, productId: string): Promise<ShoppingList> => withWishlist(customerId, (list) => removeProduct(list, productId));

/** Saved product ids, newest first. A customer who never saved anything has no list: a read never creates one. */
export async function getSavedProductIds(customerId: string): Promise<string[]> {
  const list = await getWishlist(customerId);
  return list ? productIdsOf(list) : [];
}

/** The saved products for the saved page (priced for the shopper's market); products that left the catalog are skipped. */
export async function getSavedProducts(customerId: string, ctx: Ctx): Promise<Product[]> {
  return getProductsByIds(await getSavedProductIds(customerId), ctx);
}
