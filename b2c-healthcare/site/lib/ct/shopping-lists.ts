import 'server-only';
import type { ShoppingList, ShoppingListUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { loadAccountFixtures } from '@/lib/ct/fixtures';
import { DEFAULT_LIST_ID, MAX_LIST_LINES, MAX_LIST_NAME, type ListSummary } from '@/lib/lists-types';
import { listKeyOf, LIST_DELETE_DAYS, LIST_LINE_TYPE_KEY, listLineFieldsOf, mapListSummary } from '@/lib/mappers/shopping-list';
import type { Money } from '@/lib/types';

/**
 * Saved lists ("My medicines", workstream T) on commercetools Shopping Lists: one list per `customer`, key
 * `mlv-list-<id>`, deleted by the platform 360 days after the last change. A line is a medication SKU plus the
 * prescription reference (`rxNumber`, `rxLineRef`) and the price when it was saved (to show a delta later). The
 * signature (sig) of a prescription is never stored. Every read and write is scoped by the customer id: a list that
 * belongs to somebody else is the same `null` as one that does not exist.
 * Health-data rule: names and RX numbers are never logged.
 */

export class ListLimitError extends Error {
  constructor(readonly reason: 'LINES' | 'NAME') {
    super(`list limit: ${reason}`);
    this.name = 'ListLimitError';
  }
}

async function root(): Promise<typeof apiRoot> {
  const fixtures = await loadAccountFixtures();
  return fixtures ? (fixtures.fakeListsRoot as unknown as typeof apiRoot) : apiRoot;
}

const isConflict = (e: unknown): boolean => (e as { statusCode?: number } | null)?.statusCode === 409;
const isNotFound = (e: unknown): boolean => (e as { statusCode?: number } | null)?.statusCode === 404;

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, MAX_LIST_NAME);

/** The customer's own list by id, or null (unknown and foreign are the same). */
export async function getOwnList(id: string, customerId: string): Promise<ShoppingList | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const api = await root();
  try {
    const { body } = await api.shoppingLists().withId({ ID: id }).get().execute();
    return body.customer?.id === customerId ? body : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function getOwnListByKey(key: string, customerId: string): Promise<ShoppingList | null> {
  const api = await root();
  try {
    const { body } = await api.shoppingLists().withKey({ key }).get().execute();
    return body.customer?.id === customerId ? body : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** The customer's lists, most recently changed first. */
export async function listLists(customerId: string, locale: string): Promise<ListSummary[]> {
  const api = await root();
  const { body } = await api.shoppingLists().get({ queryArgs: { where: 'customer(id=:id)', 'var.id': customerId, sort: 'lastModifiedAt desc', limit: 100 } }).execute();
  return body.results.map((l) => mapListSummary(l, locale));
}

export interface LineInput {
  sku: string;
  rxNumber: string;
  rxLineRef: string;
  /** The catalog pack price when the line is saved (for the price-moved note). */
  price: Money | null;
}

const lineAction = (l: LineInput): ShoppingListUpdateAction => ({
  action: 'addLineItem',
  sku: l.sku,
  quantity: 1,
  custom: {
    type: { typeId: 'type', key: LIST_LINE_TYPE_KEY },
    fields: { rxNumber: l.rxNumber, rxLineRef: l.rxLineRef, ...(l.price ? { savedUnitPrice: { type: 'centPrecision', currencyCode: l.price.currencyCode, centAmount: l.price.centAmount, fractionDigits: l.price.fractionDigits } } : {}) },
  },
});

/** Creates a list; `id` is the part after `mlv-list-` (a random one by default). */
export async function createList(customerId: string, name: string, locale: string, o: { id?: string; lines?: LineInput[] } = {}): Promise<ShoppingList> {
  const clean = cleanName(name);
  if (!clean) throw new ListLimitError('NAME');
  const lines = o.lines ?? [];
  if (lines.length > MAX_LIST_LINES) throw new ListLimitError('LINES');
  const api = await root();
  const { body } = await api
    .shoppingLists()
    .post({
      body: {
        key: listKeyOf(o.id ?? crypto.randomUUID()),
        name: { [locale]: clean },
        customer: { typeId: 'customer', id: customerId },
        deleteDaysAfterLastModification: LIST_DELETE_DAYS,
        lineItems: lines.map((l) => {
          const action = lineAction(l) as Extract<ShoppingListUpdateAction, { action: 'addLineItem' }>;
          return { sku: action.sku, quantity: action.quantity, custom: action.custom };
        }),
      },
    })
    .execute();
  return body;
}

/** Reads the own list again and applies `build` to it; one retry on a version conflict. Null when it is not the customer's. */
async function updateOwn(id: string, customerId: string, build: (list: ShoppingList) => ShoppingListUpdateAction[] | null): Promise<ShoppingList | null> {
  const api = await root();
  for (let attempt = 0; ; attempt += 1) {
    const list = await getOwnList(id, customerId);
    if (!list) return null;
    const actions = build(list);
    if (!actions || actions.length === 0) return list;
    try {
      const { body } = await api.shoppingLists().withId({ ID: list.id }).post({ body: { version: list.version, actions } }).execute();
      return body;
    } catch (error) {
      if (!isConflict(error) || attempt >= 1) throw error;
    }
  }
}

export async function renameList(id: string, customerId: string, name: string, locale: string): Promise<ShoppingList | null> {
  const clean = cleanName(name);
  if (!clean) throw new ListLimitError('NAME');
  return updateOwn(id, customerId, () => [{ action: 'changeName', name: { [locale]: clean } }]);
}

/**
 * Adds prescription lines. A line already on the list (same `rxNumber` and `rxLineRef`) is not added twice.
 * Returns the list and how many were new.
 */
export async function addLines(id: string, customerId: string, lines: LineInput[]): Promise<{ list: ShoppingList; added: number } | null> {
  let added = 0;
  const list = await updateOwn(id, customerId, (current) => {
    const have = new Set(current.lineItems.map((i) => listLineFieldsOf(i)).filter((f) => f !== null).map((f) => `${f.rxNumber}|${f.rxLineRef}`));
    const fresh = lines.filter((l, i) => !have.has(`${l.rxNumber}|${l.rxLineRef}`) && lines.findIndex((o) => o.rxNumber === l.rxNumber && o.rxLineRef === l.rxLineRef) === i);
    if (current.lineItems.length + fresh.length > MAX_LIST_LINES) throw new ListLimitError('LINES');
    added = fresh.length;
    return fresh.map(lineAction);
  });
  return list ? { list, added } : null;
}

export async function removeLine(id: string, customerId: string, lineId: string): Promise<ShoppingList | null> {
  return updateOwn(id, customerId, (list) => (list.lineItems.some((i) => i.id === lineId) ? [{ action: 'removeLineItem', lineItemId: lineId }] : null));
}

/** Deletes an own list. False when it is not the customer's (or does not exist). */
export async function deleteList(id: string, customerId: string): Promise<boolean> {
  const list = await getOwnList(id, customerId);
  if (!list) return false;
  const api = await root();
  try {
    await api.shoppingLists().withId({ ID: list.id }).delete({ queryArgs: { version: list.version } }).execute();
  } catch (error) {
    if (isConflict(error)) {
      const fresh = await getOwnList(id, customerId);
      if (!fresh) return true;
      await api.shoppingLists().withId({ ID: fresh.id }).delete({ queryArgs: { version: fresh.version } }).execute();
    } else if (!isNotFound(error)) throw error;
  }
  return true;
}

/** The "My medicines" list, created on first use. */
export async function getOrCreateDefaultList(customerId: string, locale: string, defaultName: string): Promise<ShoppingList> {
  const key = listKeyOf(`${DEFAULT_LIST_ID}-${customerId}`.slice(0, 256));
  const existing = await getOwnListByKey(key, customerId);
  if (existing) return existing;
  try {
    return await createList(customerId, defaultName, locale, { id: `${DEFAULT_LIST_ID}-${customerId}` });
  } catch (error) {
    // Two first saves at once: the second create hits the unique key; read the winner.
    const again = await getOwnListByKey(key, customerId);
    if (again) return again;
    throw error;
  }
}
