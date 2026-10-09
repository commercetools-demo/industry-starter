// Privacy operations are an admin tool outside the storefront architecture (no lib/ct): like the seed scripts they use the seed admin client.
import path from 'node:path';
import { withRetry, type Rec, type Root } from '../seed/lib';

export type { Rec, Root } from '../seed/lib';
export { assertProject, getAdminRoot, isMain, parseFlags } from '../seed/lib';

/** A collection of the SDK reduced to what the privacy scripts use (keeps the SDK's generics out of the scripts). */
export interface Coll {
  get(a?: { queryArgs?: Rec }): { execute(): Promise<{ body: { results: Rec[] } }> };
  withId(a: { ID: string }): {
    post(a: { body: unknown }): { execute(): Promise<{ body: Rec }> };
    delete(a: { queryArgs: Rec }): { execute(): Promise<{ body: Rec }> };
  };
}

export interface ObjectsApi {
  withContainer(a: { container: string }): { get(a?: { queryArgs?: Rec }): { execute(): Promise<{ body: { results: Rec[] } }> } };
  withContainerAndKey(a: { container: string; key: string }): {
    get(): { execute(): Promise<{ body: Rec }> };
    delete(a: { queryArgs: Rec }): { execute(): Promise<{ body: Rec }> };
  };
  post(a: { body: unknown }): { execute(): Promise<{ body: Rec }> };
}

/**
 * The 13 resource kinds a subject access request must query (docs.commercetools.com/api/gdpr, "Retrieval of collected data"),
 * in the order the page lists them, with the SDK collection and the predicate that finds one customer's records.
 * `erasable` is true where DELETE accepts `dataErasure=true` (Customer, Cart, Order, Payment, Review, ShoppingList, DiscountCode,
 * CustomObject, BusinessUnit, Quote, QuoteRequest, StagedQuote); Message is erased with its resource.
 */
export type ResourceKind =
  | 'Customer' | 'Cart' | 'Order' | 'Payment' | 'Review' | 'ShoppingList' | 'DiscountCode' | 'CustomObject'
  | 'Message' | 'BusinessUnit' | 'Quote' | 'QuoteRequest' | 'StagedQuote';

export const GDPR_KINDS: readonly ResourceKind[] = ['Customer', 'Cart', 'Order', 'Payment', 'Review', 'ShoppingList', 'DiscountCode', 'CustomObject', 'Message', 'BusinessUnit', 'Quote', 'QuoteRequest', 'StagedQuote'];

/** Kinds whose DELETE accepts `dataErasure` (all of the list except Message). */
export const ERASABLE_KINDS: readonly ResourceKind[] = GDPR_KINDS.filter((k) => k !== 'Message');

export interface QuerySpec {
  kind: Exclude<ResourceKind, 'CustomObject' | 'Message' | 'DiscountCode'>;
  /** Property of the root. */
  collection: 'customers' | 'carts' | 'orders' | 'payments' | 'reviews' | 'shoppingLists' | 'businessUnits' | 'quotes' | 'quoteRequests' | 'stagedQuotes';
  where: (customerId: string) => string;
}

const ID = /^[A-Za-z0-9_-]+$/;
/** Ids go into predicates as literals; refuse anything that is not an id (no quote can be smuggled in). */
export function safeId(id: string): string {
  if (!ID.test(id)) throw new Error(`"${id}" does not look like an id`);
  return id;
}
/** An email goes into a predicate as a literal; quotes and backslashes are refused. */
export function safeEmail(email: string): string {
  if (!/^[^\s"\\]+@[^\s"\\]+$/.test(email)) throw new Error('not an email address');
  return email;
}

export const QUERIES: readonly QuerySpec[] = [
  { kind: 'Customer', collection: 'customers', where: (id) => `id="${safeId(id)}"` },
  { kind: 'Cart', collection: 'carts', where: (id) => `customerId="${safeId(id)}"` },
  { kind: 'Order', collection: 'orders', where: (id) => `customerId="${safeId(id)}"` },
  { kind: 'Payment', collection: 'payments', where: (id) => `customer(id="${safeId(id)}")` },
  { kind: 'Review', collection: 'reviews', where: (id) => `customer(id="${safeId(id)}")` },
  { kind: 'ShoppingList', collection: 'shoppingLists', where: (id) => `customer(id="${safeId(id)}")` },
  { kind: 'BusinessUnit', collection: 'businessUnits', where: (id) => `associates(customer(id="${safeId(id)}"))` },
  { kind: 'Quote', collection: 'quotes', where: (id) => `customer(id="${safeId(id)}")` },
  { kind: 'QuoteRequest', collection: 'quoteRequests', where: (id) => `customer(id="${safeId(id)}")` },
  { kind: 'StagedQuote', collection: 'stagedQuotes', where: (id) => `customer(id="${safeId(id)}")` },
];

export const collOf = (root: Root, name: string): Coll => (root as unknown as Record<string, () => Coll>)[name].call(root);
export const objectsOf = (root: Root): ObjectsApi => (root as unknown as { customObjects: () => ObjectsApi }).customObjects();

/** Every result of a query (pages of 100). */
export async function queryAll(root: Root, collection: string, where?: string, sleep?: (ms: number) => Promise<void>): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (await withRetry(() => collOf(root, collection).get({ queryArgs: { limit: 100, offset, ...(where ? { where } : {}) } }).execute(), sleep)).body.results;
    out.push(...page);
    if (page.length < 100) return out;
  }
}

/** Every object of a container (pages of 100), optionally filtered by a `value(...)` predicate. */
export async function queryObjects(root: Root, container: string, where?: string, sleep?: (ms: number) => Promise<void>): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (await withRetry(() => objectsOf(root).withContainer({ container }).get({ queryArgs: { limit: 100, offset, ...(where ? { where } : {}) } }).execute(), sleep)).body.results;
    out.push(...page);
    if (page.length < 100) return out;
  }
}

export async function getObject(root: Root, container: string, key: string): Promise<Rec | null> {
  try {
    return (await objectsOf(root).withContainerAndKey({ container, key }).get().execute()).body;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

/** The Custom Object predicate `value(patientRef="...")`. */
export const byPatientRef = (patientRef: string): string => `value(patientRef="${safeId(patientRef)}")`;

/** A report file must not land inside the repository (it holds one person's data). */
export function assertOutsideRepo(file: string, repoDir = path.resolve(__dirname, '../../..')): string {
  const resolved = path.resolve(file);
  const rel = path.relative(repoDir, resolved);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw new Error(`Refusing to write ${file}: reports hold personal data and must go outside the repository.`);
  return resolved;
}

/** Identifiers only, for logs: never a name, email or value. */
export const idsOf = (rs: Rec[]): string[] => rs.map((r) => String(r.id ?? r.key));
