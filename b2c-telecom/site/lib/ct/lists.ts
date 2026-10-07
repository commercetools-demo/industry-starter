import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ShoppingList, ShoppingListLineItem, ShoppingListUpdateAction } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/format';
import { LIST_KEY_PREFIX, LIST_LINE_QUANTITY_MAX, LIST_LINE_QUANTITY_MIN, LIST_LINE_TYPE_KEY, LIST_NAME_MAX, MAX_LINES_PER_LIST, MAX_LISTS } from '@/lib/config/lists';
import { priceDelta } from '@/lib/lists/delta';
import { lineKey, resolveLines, type LinePrice } from '@/lib/lists/resolve';
import type { Cart, Market, Money, SavedList, SavedListDetail, SavedListLine } from '@/lib/types';
import { getApiRoot } from './client';
import { getOffersByKeys } from './catalog';
import { withTimeout } from './timeout';

// Saved lists of the signed-in customer (D-070: no /me endpoints, the storefront client reads and writes the lists). EVERY function takes
// the customer id from the SESSION and `readOwned` is the one place that decides a list is theirs: a foreign list, an unknown id and a
// guest list are the same `ListNotFoundError` (never "forbidden"). Never cached.

export class ListNotFoundError extends Error {
  constructor() {
    super('List not found');
    this.name = 'ListNotFoundError';
  }
}
export class ListLimitError extends Error {
  constructor() {
    super(`A customer may keep at most ${MAX_LISTS} lists`);
    this.name = 'ListLimitError';
  }
}
export class ListFullError extends Error {
  constructor() {
    super(`A list holds at most ${MAX_LINES_PER_LIST} lines`);
    this.name = 'ListFullError';
  }
}
export class InvalidListNameError extends Error {
  constructor() {
    super(`A list name has 1 to ${LIST_NAME_MAX} characters`);
    this.name = 'InvalidListNameError';
  }
}
export class UnknownOfferError extends Error {
  constructor() {
    super('That offer is not for sale');
    this.name = 'UnknownOfferError';
  }
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;

const sanitize = (id: string): string => id.replace(/["\\]/g, '');

/** Prices and availability of saved lines, resolved NOW from the catalog's price-selected offers (H, cached one minute) in ONE batched read; never a throwaway cart. */
export async function loadLinePrices(lines: readonly { offerKey: string; variantId: number }[], market: Market, now: Date = new Date()): Promise<Map<string, LinePrice>> {
  const offers = await getOffersByKeys([...new Set(lines.map((line) => line.offerKey))], market);
  return resolveLines(lines, offers, now);
}

export function validName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < 1 || name.length > LIST_NAME_MAX) throw new InvalidListNameError();
  return name;
}

// ---- reads ------------------------------------------------------------------------------------------------------------------------

/** The customer's list, or `ListNotFoundError`. */
export async function readOwned(customerId: string, id: string): Promise<ShoppingList> {
  let list: ShoppingList;
  try {
    list = (await withTimeout(getApiRoot().shoppingLists().withId({ ID: id }).get().execute(), 'lists.get')).body;
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 400) throw new ListNotFoundError();
    throw error;
  }
  if (!list.customer || list.customer.id !== customerId) throw new ListNotFoundError();
  return list;
}

async function queryLists(customerId: string): Promise<ShoppingList[]> {
  const { body } = await withTimeout(
    getApiRoot()
      .shoppingLists()
      .get({ queryArgs: { where: `customer(id="${sanitize(customerId)}")`, sort: 'lastModifiedAt desc', limit: MAX_LISTS + 1 } })
      .execute(),
    'lists.query',
  );
  return body.results.filter((list) => list.customer?.id === customerId);
}

const toSummary = (list: ShoppingList): SavedList => ({ id: list.id, name: getLocalizedString(list.name, 'en-US'), lineCount: list.lineItems.length, updatedAt: list.lastModifiedAt });

export async function getLists(customerId: string): Promise<SavedList[]> {
  return (await queryLists(customerId)).map(toSummary);
}

const field = (line: ShoppingListLineItem, name: string): unknown => (line.custom?.fields as Record<string, unknown> | undefined)?.[name];
const offerKeyOf = (line: ShoppingListLineItem): string => (typeof field(line, 'offerKey') === 'string' ? (field(line, 'offerKey') as string) : '');
const variantIdOf = (line: ShoppingListLineItem): number => line.variantId ?? 1;

function savedOf(line: ShoppingListLineItem): Money | null {
  const cents = field(line, 'savedAmountCents');
  const currency = field(line, 'savedCurrency');
  return typeof cents === 'number' && typeof currency === 'string' ? { centAmount: cents, currencyCode: currency } : null;
}

/** The list with every line priced now (`current`), the delta against the saved price and its availability. */
export async function toDetail(list: ShoppingList, market: Market): Promise<SavedListDetail> {
  const keyed = list.lineItems.map((line) => ({ offerKey: offerKeyOf(line), variantId: variantIdOf(line) }));
  const prices = await loadLinePrices(
    keyed.filter((line) => line.offerKey !== ''),
    market,
  );
  const lines: SavedListLine[] = list.lineItems.map((line, index) => {
    const ref = keyed[index] as { offerKey: string; variantId: number };
    const price = ref.offerKey ? prices.get(lineKey(ref.offerKey, ref.variantId)) : undefined;
    const available = price?.available ?? false;
    const saved = savedOf(line);
    const current = available ? (price?.current ?? null) : null;
    return {
      lineId: line.id,
      offerKey: ref.offerKey,
      name: price?.name || getLocalizedString(line.name, market.locale),
      term: price?.term ?? null,
      variantLabel: price?.variantLabel ?? '',
      quantity: line.quantity,
      saved,
      current,
      recurring: available ? (price?.recurring ?? false) : false,
      delta: available ? priceDelta(saved, current) : { status: 'unknown', deltaCents: 0 },
      available,
      ...(price?.reason ? { reason: price.reason } : !price ? { reason: 'NOT_PUBLISHED' } : {}),
    };
  });
  return { id: list.id, name: getLocalizedString(list.name, market.locale), lines };
}

export async function getList(customerId: string, id: string, market: Market): Promise<SavedListDetail> {
  return toDetail(await readOwned(customerId, id), market);
}

// ---- writes -----------------------------------------------------------------------------------------------------------------------

/** Reads the list fresh, builds the actions from it and posts them with its version; one retry on a version conflict (two quick clicks). */
async function write(customerId: string, id: string, plan: (list: ShoppingList) => ShoppingListUpdateAction[]): Promise<ShoppingList> {
  for (let attempt = 0; ; attempt += 1) {
    const list = await readOwned(customerId, id);
    const actions = plan(list);
    if (actions.length === 0) return list;
    try {
      return (await withTimeout(getApiRoot().shoppingLists().withId({ ID: id }).post({ body: { version: list.version, actions } }).execute(), 'lists.write')).body;
    } catch (error) {
      if (statusOf(error) !== 409 || attempt >= 1) throw error;
    }
  }
}

const localized = (name: string) => ({ 'en-US': name, 'de-DE': name });
const priceCustom = (offerKey: string, price: Money | null) => ({
  type: { typeId: 'type' as const, key: LIST_LINE_TYPE_KEY },
  fields: { offerKey, ...(price ? { savedAmountCents: price.centAmount, savedCurrency: price.currencyCode } : {}), savedAt: new Date().toISOString() },
});

interface DraftLine {
  offerKey: string;
  productId: string;
  variantId: number;
  quantity: number;
  price: Money | null;
}

export async function createList(customerId: string, rawName: unknown, lines: DraftLine[] = []): Promise<ShoppingList> {
  const name = validName(rawName);
  if ((await queryLists(customerId)).length >= MAX_LISTS) throw new ListLimitError();
  const { body } = await withTimeout(
    getApiRoot()
      .shoppingLists()
      .post({
        body: {
          key: `${LIST_KEY_PREFIX}${randomUUID()}`,
          name: localized(name),
          customer: { typeId: 'customer', id: customerId },
          lineItems: lines.slice(0, MAX_LINES_PER_LIST).map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity, custom: priceCustom(line.offerKey, line.price) })),
        },
      })
      .execute(),
    'lists.create',
  );
  return body;
}

/**
 * Copies the cart's lines (plans, handsets, add-ons, equipment) into a new list: product + variant + quantity, saved price = the cart
 * line's unit price. Fee lines and lines included at no charge are not copied (the plan brings them); a line whose offer cannot be
 * resolved is skipped.
 */
export async function createListFromCart(customerId: string, rawName: unknown, cart: Cart | null, market: Market): Promise<ShoppingList> {
  const name = validName(rawName);
  const lines = (cart?.lines ?? []).filter((line) => line.source === 'line-item' && line.kind !== 'fee' && !line.includedAtNoCharge && line.sku);
  const offers = new Map((await getOffersByKeys([...new Set(lines.map((line) => line.offerKey))], market)).map((offer) => [offer.key, offer]));
  const drafts: DraftLine[] = lines.flatMap((line) => {
    const offer = offers.get(line.offerKey);
    const variant = offer?.variants.find((entry) => entry.sku === line.sku);
    if (!offer || !variant) return [];
    return [{ offerKey: offer.key, productId: offer.id, variantId: variant.id, quantity: Math.min(Math.max(line.quantity, LIST_LINE_QUANTITY_MIN), LIST_LINE_QUANTITY_MAX), price: line.unitPrice }];
  });
  return createList(customerId, name, drafts);
}

export async function renameList(customerId: string, id: string, rawName: unknown): Promise<ShoppingList> {
  const name = validName(rawName);
  return write(customerId, id, () => [{ action: 'changeName', name: localized(name) }]);
}

export async function deleteList(customerId: string, id: string): Promise<void> {
  const list = await readOwned(customerId, id);
  await withTimeout(getApiRoot().shoppingLists().withId({ ID: id }).delete({ queryArgs: { version: list.version } }).execute(), 'lists.delete');
}

/**
 * Saves one offer variant (default: the master variant, quantity 1) with its price now as the saved price. Idempotent: the same offer
 * and variant already on the list changes nothing. A full list refuses (`ListFullError`).
 */
export async function addOffer(customerId: string, id: string, input: { offerKey: string; variantId?: number | undefined; quantity?: number | undefined }, market: Market): Promise<ShoppingList> {
  const offer = (await getOffersByKeys([input.offerKey], market))[0];
  if (!offer) throw new UnknownOfferError();
  const variant = input.variantId === undefined ? offer.variants[0] : offer.variants.find((entry) => entry.id === input.variantId);
  if (!variant) throw new UnknownOfferError();
  const quantity = Math.min(Math.max(Math.trunc(input.quantity ?? 1), LIST_LINE_QUANTITY_MIN), LIST_LINE_QUANTITY_MAX);
  const price = variant.recurringPrice ?? variant.oneTimePrice ?? variant.financedPrices?.[0] ?? null;
  return write(customerId, id, (list) => {
    if (list.lineItems.some((line) => offerKeyOf(line) === offer.key && variantIdOf(line) === variant.id)) return [];
    if (list.lineItems.length >= MAX_LINES_PER_LIST) throw new ListFullError();
    return [{ action: 'addLineItem', productId: offer.id, variantId: variant.id, quantity, custom: priceCustom(offer.key, price) }];
  });
}

export async function removeLine(customerId: string, id: string, lineId: string): Promise<ShoppingList> {
  return write(customerId, id, (list) => {
    if (!list.lineItems.some((line) => line.id === lineId)) throw new ListNotFoundError();
    return [{ action: 'removeLineItem', lineItemId: lineId }];
  });
}
