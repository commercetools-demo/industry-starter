// Customers of the store (workstream V-01, V-03, V-05). A shopper belongs to the reseller's store (`customer.stores`), so every read
// goes through the in-store endpoints: a customer or order of another store is "not found". Guests are derived from orders without a
// `customerId`, grouped by e-mail. Lists carry masked e-mail addresses only; the detail shows the full address to an Admin.
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import { aggregate, type CustomerInput, type OrderInput } from '@/lib/customers/aggregate';
import { maskCustomer } from '@/lib/customers/mask';
import { mapSubscription } from '@/lib/subscriptions/model';
import type { LogicalRole } from '@/lib/types';
import type { CustomerDetail, CustomerList, CustomerNote, CustomerTab, OrderSummary } from '@/lib/v-types';
import { parseGarage } from './garage';
import { returnRows, type OrderLike } from './returns';
import { listRecurringOrders } from './subscriptions';
import { V_CONTAINERS, readObject, upsertObject } from './v-objects';
import { vRoot } from './v-root';
import { statusOf } from './versioned';

const PAGE = 500;
const MAX_CUSTOMERS = 1000;
const MAX_ORDERS = 2500;
export const NOTE_MAX = 1000;
const NOTES_MAX = 200;
const clean = (v: string) => v.replace(/["\\]/g, '');

interface CustomerLike extends CustomerInput {
  version: number;
  stores?: { key: string }[];
  addresses?: unknown[];
  custom?: { fields?: Record<string, unknown> };
}
interface OrderRecord extends OrderInput {
  orderNumber?: string;
  custom?: { fields?: Record<string, unknown> };
}

async function readAllCustomers(storeKey: string): Promise<{ items: CustomerLike[]; truncated: boolean }> {
  const root = await vRoot();
  const items: CustomerLike[] = [];
  let total = 0;
  for (let offset = 0; offset < MAX_CUSTOMERS; offset += PAGE) {
    const { body } = await root
      .inStoreKeyWithStoreKeyValue({ storeKey })
      .customers()
      .get({ queryArgs: { limit: PAGE, offset, sort: 'createdAt desc', withTotal: true } })
      .execute();
    items.push(...(body.results as unknown as CustomerLike[]));
    total = body.total ?? items.length;
    if (items.length >= total || body.results.length === 0) break;
  }
  return { items, truncated: total > items.length };
}

async function readAllOrders(storeKey: string): Promise<{ items: OrderRecord[]; truncated: boolean }> {
  const root = await vRoot();
  const items: OrderRecord[] = [];
  let total = 0;
  for (let offset = 0; offset < MAX_ORDERS; offset += PAGE) {
    const { body } = await root
      .inStoreKeyWithStoreKeyValue({ storeKey })
      .orders()
      .get({ queryArgs: { limit: PAGE, offset, sort: 'createdAt desc', withTotal: true } })
      .execute();
    items.push(...(body.results as unknown as OrderRecord[]));
    total = body.total ?? items.length;
    if (items.length >= total || body.results.length === 0) break;
  }
  return { items, truncated: total > items.length };
}

export interface CustomerQuery {
  tab?: CustomerTab;
  q?: string;
  offset?: number;
  limit?: number;
}

export async function listCustomers(storeKey: string, query: CustomerQuery = {}): Promise<CustomerList> {
  const [customers, orders] = await Promise.all([readAllCustomers(storeKey), readAllOrders(storeKey)]);
  const { rows, kpis } = aggregate(customers.items, orders.items, query.q);
  const tab = query.tab ?? 'all';
  const shown = rows.filter((r) => (tab === 'all' ? true : tab === 'registered' ? r.type === 'Registered' : r.type === 'Guest'));
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(Math.max(1, query.limit ?? 50), 100);
  return { rows: shown.slice(offset, offset + limit), total: shown.length, kpis, truncated: customers.truncated || orders.truncated };
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

function summaryOf(order: OrderRecord): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? order.id,
    createdAt: order.createdAt,
    totalCents: order.totalPrice.centAmount,
    currency: order.totalPrice.currencyCode,
    state: order.orderState ?? 'Open',
    deliveredAt: text(order.custom?.fields?.deliveredAt) ?? null,
  };
}

/** The store's customer by id (404 when the customer belongs to another store or does not exist). */
async function ownCustomer(storeKey: string, id: string): Promise<CustomerLike> {
  const root = await vRoot();
  try {
    const { body } = await root.inStoreKeyWithStoreKeyValue({ storeKey }).customers().withId({ ID: id }).get().execute();
    return body as unknown as CustomerLike;
  } catch (error) {
    if (statusOf(error) === 404) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
    throw error;
  }
}

const notesKey = (storeKey: string, customerId: string) => `${storeKey}--${customerId}`;
interface NotesValue {
  storeKey: string;
  customerId: string;
  notes: CustomerNote[];
}

async function readNotes(storeKey: string, customerId: string): Promise<CustomerNote[]> {
  const stored = await readObject<NotesValue>(V_CONTAINERS.notes, notesKey(storeKey, customerId));
  return stored && stored.value.storeKey === storeKey ? stored.value.notes : [];
}

export async function getCustomerDetail(storeKey: string, id: string, roles: LogicalRole[], locale = 'en-US'): Promise<CustomerDetail> {
  const customer = await ownCustomer(storeKey, id);
  const root = await vRoot();
  const { body } = await root
    .inStoreKeyWithStoreKeyValue({ storeKey })
    .orders()
    .get({ queryArgs: { where: `customerId="${clean(id)}"`, sort: 'createdAt desc', limit: 100, withTotal: false } })
    .execute();
  const orders = body.results as unknown as (OrderRecord & OrderLike)[];
  const subscriptions = (await listRecurringOrders(storeKey)).filter((r) => r.customer?.id === id).map((r) => mapSubscription(r, locale));
  const facts = maskCustomer(
    { email: customer.email, mobile: text(customer.custom?.fields?.mobile), addresses: customer.addresses ?? [] },
    roles,
  );
  const fields = customer.custom?.fields;
  const name = [customer.firstName?.trim(), customer.lastName?.trim()].filter(Boolean).join(' ');
  return {
    id: customer.id,
    name: name || facts.email,
    email: facts.email,
    ...(facts.mobile ? { mobile: facts.mobile } : {}),
    createdAt: customer.createdAt,
    marketingConsent: typeof fields?.marketingConsent === 'boolean' ? fields.marketingConsent : null,
    marketingConsentAt: text(fields?.marketingConsentAt) ?? null,
    orders: orders.map(summaryOf),
    garage: parseGarage(fields?.garage),
    subscriptions,
    returns: returnRows(orders, locale),
    notes: await readNotes(storeKey, id),
  };
}

/** Adds a note (text, at most 1,000 characters, stored and shown as text). Add and list only. */
export async function addCustomerNote(storeKey: string, customerId: string, noteText: string, by: string, now: Date = new Date()): Promise<CustomerNote[]> {
  const body = noteText.trim();
  if (body.length === 0 || body.length > NOTE_MAX) throw new CatalogError(400, 'NOTE_INVALID', `The note must have 1 to ${NOTE_MAX} characters`);
  await ownCustomer(storeKey, customerId);
  const value = await upsertObject<NotesValue>(V_CONTAINERS.notes, notesKey(storeKey, customerId), (current) => {
    const notes = current && current.storeKey === storeKey ? current.notes : [];
    if (notes.length >= NOTES_MAX) throw new CatalogError(409, 'NOTES_FULL', 'This customer has the maximum number of notes');
    return { storeKey, customerId, notes: [...notes, { text: body, by, at: now.toISOString() }] };
  });
  return value.notes;
}

/** Name for the shop-as banner and the handoff record: the customer's own name, else the e-mail address (Admin only). */
export async function customerForShopAs(storeKey: string, id: string): Promise<{ id: string; name: string }> {
  const customer = await ownCustomer(storeKey, id);
  const name = [customer.firstName?.trim(), customer.lastName?.trim()].filter(Boolean).join(' ');
  return { id: customer.id, name: name || customer.email };
}
