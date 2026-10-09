import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Cart, CartAddLineItemAction, CartDraft, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import type { Session } from '../session-core';
import type { QuoteList, QuoteListLine, Service } from '../types';
import { getLocalizedString } from '../utils';
import { asAssociate } from './associate';
import { apiRoot } from './client';

/**
 * The quote list is a Cart in the default store (malva-quote-list › Quote list is a zero-priced cart in the default store).
 * Anonymous visitors use the in-store carts endpoint with an `anonymousId`; signed-in clients with a Business Unit
 * always go through the as-associate chain. Lines are zero-priced (D12) and no amount is ever mapped out of here (D21).
 */
export const LINE_TYPE_KEY = 'mpw-line-service';
export const ONE_OFF = 'one-off';

export type ListSession = Pick<Session, 'customerId' | 'businessUnitKey' | 'storeKey' | 'cartId' | 'currency' | 'country' | 'locale'>;

interface Req<T> { execute(): Promise<{ body: T }> }
interface CartsApi {
  get(args: { queryArgs: Record<string, unknown> }): Req<{ results: Cart[] }>;
  post(args: { body: CartDraft }): Req<Cart>;
  withId(args: { ID: string }): {
    get(): Req<Cart>;
    post(args: { body: { version: number; actions: CartUpdateAction[] } }): Req<Cart>;
    delete(args: { queryArgs: { version: number } }): Req<Cart>;
  };
}

export const isAssociate = (s: Pick<Session, 'customerId' | 'businessUnitKey'>): boolean => Boolean(s.customerId && s.businessUnitKey);
const storeKeyOf = (s: Pick<Session, 'storeKey'>): string => s.storeKey ?? process.env.CTP_DEFAULT_STORE_KEY ?? 'mpw-web';
const storeCarts = (s: Pick<Session, 'storeKey'>): CartsApi => apiRoot.inStoreKeyWithStoreKeyValue({ storeKey: storeKeyOf(s) }).carts() as unknown as CartsApi;
/** The carts endpoint for this visitor: the associate chain when signed in with a unit, otherwise the in-store endpoint. */
export const cartsApi = (s: ListSession): CartsApi => (isAssociate(s) ? (asAssociate(s).carts() as unknown as CartsApi) : storeCarts(s));

const statusOf = (error: unknown): number | undefined => (error as { statusCode?: number; status?: number })?.statusCode ?? (error as { status?: number })?.status;
const codesOf = (error: unknown): string[] => ((error as { body?: { errors?: Array<{ code?: string }> } })?.body?.errors ?? []).map((e) => e.code ?? '');

/** A cart that cannot be read (gone, converted, or not visible to this role) is "no list", never an error. */
async function tryGet(api: CartsApi, id: string): Promise<Cart | undefined> {
  try {
    return (await api.withId({ ID: id }).get().execute()).body;
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || status === 403 || status === 400) return undefined;
    throw error;
  }
}

const lineFields = (frequency?: string, note?: string) => ({ ...(frequency ? { frequency } : {}), ...(note ? { note } : {}) });
const lineCustom = (fields: Record<string, string>) => (Object.keys(fields).length ? { type: { typeId: 'type' as const, key: LINE_TYPE_KEY }, fields } : undefined);

/** What a list line needs to be recreated in another cart. */
export interface SourceLine { productId: string; variantId: number; frequency?: string; note?: string }

export function readLines(cart: Cart): SourceLine[] {
  return cart.lineItems.filter((li) => Boolean(li.productId)).map((li) => {
    const f = (li.custom?.fields ?? {}) as Record<string, unknown>;
    return { productId: li.productId, variantId: li.variant.id, ...(typeof f.frequency === 'string' ? { frequency: f.frequency } : {}), ...(typeof f.note === 'string' && f.note ? { note: f.note } : {}) };
  });
}

const addAction = (l: SourceLine): CartAddLineItemAction => ({ action: 'addLineItem', productId: l.productId, variantId: l.variantId, quantity: 1, ...(lineCustom(lineFields(l.frequency, l.note)) ? { custom: lineCustom(lineFields(l.frequency, l.note)) } : {}) });

/** The draft of a new list: single shipping mode, currency and country from the active locale, no delivery or discount data. */
export function draftFor(s: ListSession, lines: SourceLine[] = []): CartDraft {
  const base = { currency: s.currency, country: s.country, locale: s.locale, shippingMode: 'Single' as const, ...(lines.length ? { lineItems: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: 1, ...(lineCustom(lineFields(l.frequency, l.note)) ? { custom: lineCustom(lineFields(l.frequency, l.note)) } : {}) })) } : {}) };
  return isAssociate(s)
    ? { ...base, customerId: s.customerId, businessUnit: { typeId: 'business-unit', key: s.businessUnitKey! }, store: { typeId: 'store', key: storeKeyOf(s) } }
    : { ...base, anonymousId: randomUUID() };
}

/** Creates the cart with all lines at once; if one line cannot be priced the others are still added one by one and the failing sku is logged. */
export async function createListCart(s: ListSession, lines: SourceLine[] = []): Promise<Cart> {
  const api = cartsApi(s);
  try {
    return (await api.post({ body: draftFor(s, lines) }).execute()).body;
  } catch (error) {
    if (lines.length === 0 || statusOf(error) !== 400) throw translate(error);
  }
  let cart = (await api.post({ body: draftFor(s) }).execute().catch((e) => { throw translate(e); })).body;
  for (const line of lines) {
    try { cart = await mutateCart(s, cart, [addAction(line)]); } catch (e) { console.error('quote list: could not add line', { productId: line.productId, code: codesOf(e)[0] ?? 'unknown' }); }
  }
  return cart;
}

/** Permission and conflict failures become safe messages; everything else is rethrown for the generic 500. */
export function translate(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  const status = statusOf(error);
  if (status === 403) return new ApiError(403, 'Your role does not allow changes to the quote list. Please ask your company administrator.');
  return error;
}

/** One update with a retry on a version conflict (the cart is read again and the same actions are applied). */
export async function mutateCart(s: ListSession, cart: Cart, actions: CartUpdateAction[]): Promise<Cart> {
  const api = cartsApi(s);
  let current = cart;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await api.withId({ ID: current.id }).post({ body: { version: current.version, actions } }).execute()).body;
    } catch (error) {
      if (statusOf(error) === 409 && attempt < 2) { current = (await api.withId({ ID: current.id }).get().execute()).body; continue; }
      throw translate(error);
    }
  }
}

/** Deletes a cart the visitor no longer needs (for example the guest list after it was copied into a company cart). Never throws. */
export const discardCart = async (s: ListSession, cart: Cart): Promise<void> => removeCart(cartsApi(s), cart);

const removeCart = async (api: CartsApi, cart: Cart): Promise<void> => {
  try { await api.withId({ ID: cart.id }).delete({ queryArgs: { version: cart.version } }).execute(); } catch { /* an old cart that cannot be deleted expires on its own */ }
};

const sameLine = (a: { productId: string; variantId: number }, b: { productId: string; variantId: number }) => a.productId === b.productId && a.variantId === b.variantId;

export interface Resolved { cart?: Cart; /** The list was started again because its currency no longer matches the locale. */ rebuilt: boolean }

/**
 * Finds the visitor's list and brings it to the shape this visitor needs:
 * - a cart in another currency (locale switch) is copied into a cart in the current currency;
 * - for a signed-in client, a cart that is not in the Business Unit (the sign-in merge produces one) is merged into the client's Business Unit cart;
 * - an empty result with `create` false means "no list yet".
 */
export async function resolveCart(s: ListSession): Promise<Resolved> {
  const own = cartsApi(s);
  const sources: Array<{ cart: Cart; api: CartsApi }> = [];
  let rebuilt = false;
  let cart = s.cartId ? await tryGet(own, s.cartId) : undefined;
  if (cart && (cart.cartState !== 'Active' || cart.totalPrice.currencyCode !== s.currency)) {
    if (cart.cartState === 'Active') { sources.push({ cart, api: own }); rebuilt = true; }
    cart = undefined;
  }
  if (!cart && s.cartId && isAssociate(s)) {
    const orphan = await tryGet(storeCarts(s), s.cartId);
    if (orphan && orphan.cartState === 'Active' && !orphan.businessUnit && !sources.some((x) => x.cart.id === orphan.id)) {
      sources.push({ cart: orphan, api: storeCarts(s) });
      if (orphan.totalPrice.currencyCode !== s.currency) rebuilt = true;
    }
  }
  if (!cart && isAssociate(s)) {
    const found = await own.get({ queryArgs: { where: `cartState="Active" and customerId="${s.customerId}" and totalPrice(currencyCode="${s.currency}")`, sort: 'lastModifiedAt desc', limit: 1 } }).execute().then((r) => r.body.results[0]).catch((e) => { if ([400, 403].includes(statusOf(e) ?? 0)) return undefined; throw e; });
    cart = found;
  }
  const movable = sources.filter((x) => x.cart.lineItems.length > 0);
  if (movable.length === 0) {
    for (const x of sources) await removeCart(x.api, x.cart);
    return { cart, rebuilt: false };
  }
  const incoming: SourceLine[] = [];
  for (const x of movable) for (const line of readLines(x.cart)) if (!incoming.some((i) => sameLine(i, line)) && !(cart && cart.lineItems.some((li) => sameLine({ productId: li.productId, variantId: li.variant.id }, line)))) incoming.push(line);
  if (!cart) cart = await createListCart(s, incoming);
  else if (incoming.length) cart = await addLines(s, cart, incoming);
  for (const x of sources) await removeCart(x.api, x.cart);
  return { cart, rebuilt };
}

async function addLines(s: ListSession, cart: Cart, lines: SourceLine[]): Promise<Cart> {
  try {
    return await mutateCart(s, cart, lines.map(addAction));
  } catch (error) {
    if (statusOf(error) !== 400) throw error;
  }
  let current = cart;
  for (const line of lines) {
    try { current = await mutateCart(s, current, [addAction(line)]); } catch (e) { console.error('quote list: could not add line', { productId: line.productId, code: codesOf(e)[0] ?? 'unknown' }); }
  }
  return current;
}

/** Cart lines to the app type. A line whose service is not in the current catalogue is flagged "no longer available". */
export function mapCart(cart: Cart | undefined, services: Service[], locale: string): QuoteList {
  if (!cart) return { id: null, lines: [], count: 0 };
  const lines = cart.lineItems.filter((li) => Boolean(li.productId)).map((li: LineItem): QuoteListLine => {
    const service = services.find((s) => s.id === li.productId);
    const f = (li.custom?.fields ?? {}) as Record<string, unknown>;
    return {
      id: li.id,
      serviceId: li.productId,
      slug: service?.slug ?? getLocalizedString(li.productSlug as Record<string, string> | undefined, locale),
      name: service?.name ?? getLocalizedString(li.name, locale),
      ...(typeof f.frequency === 'string' ? { frequency: f.frequency } : {}),
      ...(typeof f.note === 'string' && f.note ? { note: f.note } : {}),
      quantity: li.quantity,
      available: Boolean(service),
      ...(service ? { category: service.category, frequencies: service.frequencies.filter((x) => x !== ONE_OFF), needsWasteDetails: service.needsWasteDetails } : {}),
    };
  });
  return { id: cart.id, lines, count: lines.length };
}

export interface ListState { list: QuoteList; /** The cart id the session should now hold (undefined: clear it). */ cartId?: string; rebuilt: boolean }

const state = (cart: Cart | undefined, services: Service[], locale: string, rebuilt: boolean): ListState => ({ list: mapCart(cart, services, locale), cartId: cart?.id, rebuilt });

export async function getQuoteList(s: ListSession, services: Service[]): Promise<ListState> {
  const { cart, rebuilt } = await resolveCart(s);
  return state(cart, services, s.locale, rebuilt);
}

/** Locale switch: the list of the old currency is started again in the new one. Returns the cart id for the new session. */
export async function rebuildQuoteList(s: ListSession): Promise<{ cartId?: string; rebuilt: boolean }> {
  const { cart, rebuilt } = await resolveCart(s);
  return { cartId: cart?.id, rebuilt };
}

function checkFrequency(service: Service, frequency: string | undefined): void {
  if (frequency && frequency !== ONE_OFF && !service.frequencies.includes(frequency)) throw new ApiError(400, 'Choose a frequency this service offers.');
}

const cleanNote = (note: unknown): string | undefined => (typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : undefined);

/** Adds a service by its product (variant 1 holds the zero price in every launch currency). A second add returns the existing line. */
export async function addService(s: ListSession, service: Service, services: Service[], options: { frequency?: string; note?: unknown } = {}): Promise<ListState & { alreadyInList: boolean }> {
  checkFrequency(service, options.frequency);
  const line: SourceLine = { productId: service.id, variantId: 1, frequency: options.frequency || undefined, note: cleanNote(options.note) };
  const { cart, rebuilt } = await resolveCart(s);
  if (cart?.lineItems.some((li) => li.productId === service.id)) return { ...state(cart, services, s.locale, rebuilt), alreadyInList: true };
  try {
    const next = cart ? await mutateCart(s, cart, [addAction(line)]) : (await cartsApi(s).post({ body: draftFor(s, [line]) }).execute()).body;
    return { ...state(next, services, s.locale, rebuilt), alreadyInList: false };
  } catch (error) {
    const translated = translate(error);
    if (translated instanceof ApiError) throw translated;
    if (statusOf(error) === 400) {
      // Typically a variant without a price in this currency (a seeding error): generic message for the visitor, the sku for the team.
      console.error('quote list: add failed', { service: service.key, slug: service.slug, currency: s.currency, code: codesOf(error)[0] ?? 'unknown' });
      throw new ApiError(422, 'We could not add this service. Please try again.');
    }
    throw error;
  }
}

export async function updateLine(s: ListSession, lineItemId: string, patch: { frequency?: unknown; note?: unknown }, services: Service[]): Promise<ListState> {
  const { cart, rebuilt } = await resolveCart(s);
  const li = cart?.lineItems.find((x) => x.id === lineItemId);
  if (!cart || !li) throw new ApiError(404, 'That service is not in your quote list.');
  const current = (li.custom?.fields ?? {}) as Record<string, unknown>;
  let frequency = typeof current.frequency === 'string' ? current.frequency : undefined;
  let note = typeof current.note === 'string' ? current.note : undefined;
  if ('frequency' in patch) {
    if (patch.frequency !== undefined && typeof patch.frequency !== 'string') throw new ApiError(400, 'Choose a frequency this service offers.');
    const service = services.find((x) => x.id === li.productId);
    if (patch.frequency && service) checkFrequency(service, patch.frequency);
    frequency = patch.frequency || undefined;
  }
  if ('note' in patch) note = cleanNote(patch.note);
  const fields = lineFields(frequency, note);
  const action: CartUpdateAction = { action: 'setLineItemCustomType', lineItemId, ...(lineCustom(fields) ? { type: lineCustom(fields)!.type, fields } : {}) };
  return state(await mutateCart(s, cart, [action]), services, s.locale, rebuilt);
}

export async function removeLine(s: ListSession, lineItemId: string, services: Service[]): Promise<ListState> {
  const { cart, rebuilt } = await resolveCart(s);
  if (!cart || !cart.lineItems.some((x) => x.id === lineItemId)) throw new ApiError(404, 'That service is not in your quote list.');
  return state(await mutateCart(s, cart, [{ action: 'removeLineItem', lineItemId }]), services, s.locale, rebuilt);
}
