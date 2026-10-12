// Product and cart discounts of a store (T-09): list, create (inactive), edit, toggle, delete, rank. Every discount is checked
// against the session's store before it is read or written (404 for a foreign id, so existence does not leak), and Malva-funded
// discounts are read-only for a reseller (403 LOCKED_MALVA_FUNDED). There is no price floor and no cost check (Q-T03): a rule is
// valid when its ranges and schedule are (lib/catalog/discount-rule.ts `validateRule`).
import 'server-only';
import type { CartDiscount, CartDiscountUpdateAction, ProductDiscount, ProductDiscountUpdateAction } from '@commercetools/platform-sdk';
import { CatalogError } from '@/lib/catalog/errors';
import {
  compileCartDiscount,
  compileProductDiscount,
  validateRule,
  type CartCondition,
  type CartRule,
  type Effect,
  type ProductRule,
  type ProductScope,
} from '@/lib/catalog/discount-rule';
import { allocateSortOrder, inBand, rankToSortOrders } from '@/lib/catalog/sort-order';
import type { CategoryOption, DiscountKind, DiscountView } from '@/lib/catalog/types';
import { listCategories } from './catalog-data';
import { catalogRoot } from './catalog-root';
import { belongsToStoreCart, belongsToStoreProduct, isDraftKey, isMalvaFundedCart, isMalvaFundedProduct, isOwnCoopDiscount, malvaCartVisibleTo, type StoreScope } from './discount-access';
import { getSellerStore, type SellerStore } from './store-info';
import { retryOnConflict } from './versioned';

type Discount = ProductDiscount | CartDiscount;

export interface DiscountDetail extends DiscountView {
  /** The structured rule when the discount has the shape the editor builds; null for a rule made elsewhere (shown read-only). */
  rule: ProductRule | CartRule | null;
  /** Raw predicate, for display of rules the editor cannot represent. */
  predicate: string;
}

const DRAFT_NAME = {
  product: { 'de-DE': 'Neue Produktregel (Entwurf)', 'en-US': 'New product rule (draft)' },
  cart: { 'de-DE': 'Neue Warenkorbregel (Entwurf)', 'en-US': 'New cart rule (draft)' },
} as const;

const scopeOf = (store: SellerStore): StoreScope => ({ storeKey: store.key, channelIds: [store.retailChannel.id, ...store.branchChannels.map((c) => c.id)] });

async function fetchAll(kind: DiscountKind): Promise<Discount[]> {
  const root = await catalogRoot();
  const out: Discount[] = [];
  for (let offset = 0; ; offset += 500) {
    const api = kind === 'product' ? root.productDiscounts() : root.cartDiscounts();
    const { body } = await api.get({ queryArgs: { limit: 500, offset, sort: 'sortOrder desc' } }).execute();
    out.push(...(body.results as Discount[]));
    if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
  }
  return out;
}

// ---- parsing the platform objects back into the editor's vocabulary ----

const idOfKey = (categories: readonly CategoryOption[], key: string) => categories.find((c) => c.key === key);

function parseScope(predicate: string, categories: readonly CategoryOption[]): ProductScope | { kind: 'custom'; text: string } {
  const bare = predicate.replace(/ and channel\.id = "[^"]*"$/, '');
  if (bare === 'true') return { kind: 'all' };
  const byId = /^categories\.id contains any \("([A-Za-z0-9_-]+)"\)$/.exec(bare);
  if (byId) {
    const c = categories.find((x) => x.id === byId[1]);
    return { kind: 'category', categoryId: byId[1], label: c ? Object.values(c.name)[0] : byId[1] };
  }
  const byKey = /^(?:categoriesWithAncestors|categories)\.key contains "([A-Za-z0-9_-]+)"$/.exec(bare);
  if (byKey) {
    const c = idOfKey(categories, byKey[1]);
    if (c) return { kind: 'category', categoryId: c.id, label: Object.values(c.name)[0] };
  }
  const skus = /^sku in \((.+)\)$/.exec(bare);
  if (skus) {
    const list = [...skus[1].matchAll(/"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
    if (list.length) return { kind: 'skus', skus: list };
  }
  return { kind: 'custom', text: bare };
}

const toCents = (decimal: string) => Math.round(Number(decimal) * 100);

function parseCondition(predicate: string, categories: readonly CategoryOption[]): CartCondition | { kind: 'custom'; text: string } {
  if (predicate === 'true') return { kind: 'always' };
  const total = /^(?:totalPrice|lineItemTotal\(true\)) >= "(\d+(?:\.\d{1,2})?) [A-Z]{3}"$/.exec(predicate);
  if (total) return { kind: 'cartTotalAtLeast', centAmount: toCents(total[1]) };
  const exists = /^lineItemExists\((.+)\)$/.exec(predicate);
  if (exists) {
    const inner = parseScope(exists[1], categories);
    if (inner.kind === 'category') return { kind: 'category', categoryId: inner.categoryId };
  }
  return { kind: 'custom', text: predicate };
}

function parseEffect(value: ProductDiscount['value'] | CartDiscount['value'], target?: CartDiscount['target']): Effect | { kind: 'custom'; text: string } {
  if (value.type === 'relative') {
    if (target?.type === 'shipping' && value.permyriad === 10000) return { kind: 'freeShipping' };
    return { kind: 'relative', percent: value.permyriad / 100 };
  }
  if (value.type === 'absolute') return { kind: 'absolute', centAmount: value.money[0]?.centAmount ?? 0 };
  return { kind: 'custom', text: value.type };
}

const isCustom = (x: { kind: string }): x is { kind: 'custom'; text: string } => x.kind === 'custom';

function codeMap(codes: { code: string; cartDiscounts: { id: string }[] }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of codes) for (const ref of c.cartDiscounts) if (!out.has(ref.id)) out.set(ref.id, c.code);
  return out;
}

async function fetchCodes(): Promise<{ code: string; cartDiscounts: { id: string }[] }[]> {
  const root = await catalogRoot();
  const { body } = await root.discountCodes().get({ queryArgs: { limit: 500 } }).execute();
  return body.results;
}

function view(d: Discount, kind: DiscountKind, funded: 'malva' | 'store', rank: number | null, categories: readonly CategoryOption[], codes: Map<string, string>): DiscountDetail {
  const code = codes.get(d.id);
  const name = { ...d.name };
  const schedule = { ...(d.validFrom ? { validFrom: d.validFrom } : {}), ...(d.validUntil ? { validUntil: d.validUntil } : {}) };
  const common = { id: d.id, version: d.version, key: d.key ?? '', kind, name, ...schedule, isActive: d.isActive, sortOrder: d.sortOrder, funded, rank, draft: isDraftKey(d.key), ...(code ? { code } : {}) };

  if (kind === 'cart') {
    const cart = d as CartDiscount;
    const condition = parseCondition(cart.cartPredicate, categories);
    const effect = parseEffect(cart.value, cart.target);
    const stacking = cart.stackingMode as CartRule['stacking'];
    const rule: CartRule | null = isCustom(condition) || isCustom(effect) ? null : { name, condition, effect, stacking, ...(code ? { code } : {}), ...schedule };
    return { ...common, scope: condition, effect, stacking, rule, predicate: cart.cartPredicate };
  }
  const product = d as ProductDiscount;
  const scope = parseScope(product.predicate, categories);
  const effect = parseEffect(product.value);
  const rule: ProductRule | null = isCustom(scope) || isCustom(effect) || effect.kind === 'freeShipping' ? null : { name, scope, effect, ...schedule };
  return { ...common, scope, effect, rule, predicate: product.predicate };
}

// ---- reads ----

/** The store's own discounts of a kind, ranked, plus the Malva-funded ones (locked, first). */
export async function listDiscounts(storeKey: string, kind: DiscountKind): Promise<DiscountDetail[]> {
  const store = await getSellerStore(storeKey);
  const scope = scopeOf(store);
  const [all, categories, codes] = await Promise.all([fetchAll(kind), listCategories(), fetchCodes()]);
  const byCode = codeMap(codes);
  const malvaOf = (d: Discount) => (kind === 'product' ? isMalvaFundedProduct(d as ProductDiscount) : isMalvaFundedCart(d as CartDiscount));
  const ownOf = (d: Discount) => (kind === 'product' ? belongsToStoreProduct(d as ProductDiscount, scope) : belongsToStoreCart(d as CartDiscount, scope));
  const malva = all.filter((d) => malvaOf(d) && (kind === 'product' || malvaCartVisibleTo(d as CartDiscount, storeKey)));
  const own = all.filter((d) => !malvaOf(d) && ownOf(d));
  return [
    ...malva.map((d) => view(d, kind, 'malva', null, categories, byCode)),
    ...own.map((d, i) => view(d, kind, 'store', i + 1, categories, byCode)),
  ];
}

interface Loaded {
  store: SellerStore;
  discount: Discount;
  malva: boolean;
}

/** Reads one discount by id; a discount of another store is 404 (not 403). */
async function loadForStore(storeKey: string, kind: DiscountKind, id: string): Promise<Loaded> {
  const store = await getSellerStore(storeKey);
  const root = await catalogRoot();
  let discount: Discount;
  try {
    const request = kind === 'product' ? root.productDiscounts().withId({ ID: id }).get() : root.cartDiscounts().withId({ ID: id }).get();
    discount = (await request.execute()).body as Discount;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
    throw error;
  }
  const scope = scopeOf(store);
  const malva = kind === 'product' ? isMalvaFundedProduct(discount as ProductDiscount) : isMalvaFundedCart(discount as CartDiscount);
  const own = kind === 'product' ? belongsToStoreProduct(discount as ProductDiscount, scope) : belongsToStoreCart(discount as CartDiscount, scope);
  if (!malva && !own) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
  if (malva && kind === 'cart' && !malvaCartVisibleTo(discount as CartDiscount, storeKey)) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
  return { store, discount, malva };
}

const locked = () => new CatalogError(403, 'LOCKED_MALVA_FUNDED', 'Malva-funded discounts cannot be changed');

export async function getDiscount(storeKey: string, kind: DiscountKind, id: string): Promise<DiscountDetail> {
  const { discount, malva } = await loadForStore(storeKey, kind, id);
  const [categories, codes] = await Promise.all([listCategories(), fetchCodes()]);
  const rank = malva ? null : ((await listDiscounts(storeKey, kind)).find((d) => d.id === id)?.rank ?? null);
  return view(discount, kind, malva ? 'malva' : 'store', rank, categories, codeMap(codes));
}

// ---- writes ----

const slug = (name: Record<string, string>) =>
  (name['en-US'] || name['de-DE'] || 'rule')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'rule';
const random4 = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');
const newKey = (storeKey: string, name: Record<string, string>, draft: boolean) => `${storeKey}-${draft ? 'new' : slug(name)}-${random4()}${draft ? '-draft' : ''}`;

async function heldSortOrders(kind: DiscountKind): Promise<Set<string>> {
  return new Set((await fetchAll(kind)).map((d) => d.sortOrder));
}

function assertRule(rule: ProductRule | CartRule): void {
  const issues = validateRule(rule);
  if (issues.length) throw new CatalogError(400, 'INVALID_RULE', issues[0].message, { issues });
}

async function assertCodeFree(code: string): Promise<void> {
  const root = await catalogRoot();
  const { body } = await root.discountCodes().get({ queryArgs: { where: 'code=:c', 'var.c': code, limit: 1 } }).execute();
  if (body.results.length) throw new CatalogError(409, 'CODE_TAKEN', 'This code is already in use');
}

async function createCode(code: string, discountId: string, name: Record<string, string>): Promise<void> {
  const root = await catalogRoot();
  try {
    await root.discountCodes().post({ body: { code, name, cartDiscounts: [{ typeId: 'cart-discount', id: discountId }], isActive: true } }).execute();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) throw new CatalogError(409, 'CODE_TAKEN', 'This code is already in use');
    throw error;
  }
}

/** "New product discount" and "New cart discount": an inactive, unscheduled draft the editor completes. */
export async function createDiscountDraft(storeKey: string, kind: DiscountKind): Promise<DiscountDetail> {
  const store = await getSellerStore(storeKey);
  const root = await catalogRoot();
  const sortOrder = allocateSortOrder(kind, await heldSortOrders(kind), 'reseller');
  const name = { ...DRAFT_NAME[kind] };
  const options = { key: newKey(storeKey, name, true), currencies: store.currencies };
  const created =
    kind === 'product'
      ? (await root.productDiscounts().post({ body: { ...compileProductDiscount({ name, scope: { kind: 'all' }, effect: { kind: 'relative', percent: 0.01 } }, store.retailChannel.id, options), sortOrder } }).execute()).body
      : (await root.cartDiscounts().post({ body: { ...compileCartDiscount({ name, condition: { kind: 'always' }, effect: { kind: 'relative', percent: 0.01 }, stacking: 'Stacking' }, storeKey, options), sortOrder } }).execute()).body;
  return getDiscount(storeKey, kind, created.id);
}

/** Creates a complete discount, inactive. A cart rule with a code also creates the (unique) discount code. */
export async function createDiscount(storeKey: string, kind: DiscountKind, rule: ProductRule | CartRule): Promise<DiscountDetail> {
  assertRule(rule);
  const store = await getSellerStore(storeKey);
  const root = await catalogRoot();
  const code = 'condition' in rule ? rule.code : undefined;
  if (code) await assertCodeFree(code);
  const options = { key: newKey(storeKey, rule.name, false), currencies: store.currencies, currency: store.currencies[0] };
  const sortOrder = allocateSortOrder(kind, await heldSortOrders(kind), 'reseller');
  let id: string;
  if (kind === 'product') {
    id = (await root.productDiscounts().post({ body: { ...compileProductDiscount(rule as ProductRule, store.retailChannel.id, options), sortOrder } }).execute()).body.id;
  } else {
    id = (await root.cartDiscounts().post({ body: { ...compileCartDiscount(rule as CartRule, storeKey, options), sortOrder } }).execute()).body.id;
    if (code) await createCode(code, id, rule.name);
  }
  return getDiscount(storeKey, kind, id);
}

/** Saves a complete rule into an existing discount. The channel clause (product) or stores (cart) can never change, so an edit cannot widen the scope. */
export async function updateDiscount(storeKey: string, kind: DiscountKind, id: string, rule: ProductRule | CartRule): Promise<DiscountDetail> {
  const first = await loadForStore(storeKey, kind, id);
  if (first.malva) throw locked();
  assertRule(rule);
  const store = first.store;
  const root = await catalogRoot();
  const code = 'condition' in rule ? rule.code : undefined;
  if (code && !(await fetchCodes()).some((c) => c.code === code && c.cartDiscounts.some((r) => r.id === id))) await assertCodeFree(code);

  await retryOnConflict(async () => {
    const { discount } = await loadForStore(storeKey, kind, id);
    const schedule = [
      { action: 'setValidFrom' as const, validFrom: rule.validFrom },
      { action: 'setValidUntil' as const, validUntil: rule.validUntil },
    ];
    const finalKey = isDraftKey(discount.key) ? { action: 'setKey' as const, key: newKey(storeKey, rule.name, false) } : undefined;
    if (kind === 'product') {
      const draft = compileProductDiscount(rule as ProductRule, store.retailChannel.id, { currencies: store.currencies });
      const actions: ProductDiscountUpdateAction[] = [
        { action: 'changeName', name: draft.name },
        { action: 'changeValue', value: draft.value },
        { action: 'changePredicate', predicate: draft.predicate },
        ...schedule,
        ...(finalKey ? [finalKey] : []),
      ];
      await root.productDiscounts().withId({ ID: id }).post({ body: { version: discount.version, actions } }).execute();
    } else {
      const draft = compileCartDiscount(rule as CartRule, storeKey, { currencies: store.currencies, currency: store.currencies[0] });
      const actions: CartDiscountUpdateAction[] = [
        { action: 'changeName', name: draft.name },
        { action: 'changeValue', value: draft.value },
        { action: 'changeCartPredicate', cartPredicate: draft.cartPredicate },
        { action: 'changeTarget', target: draft.target },
        { action: 'changeStackingMode', stackingMode: draft.stackingMode },
        { action: 'changeRequiresDiscountCode', requiresDiscountCode: draft.requiresDiscountCode },
        ...schedule,
        ...(finalKey ? [finalKey] : []),
      ];
      await root.cartDiscounts().withId({ ID: id }).post({ body: { version: discount.version, actions } }).execute();
    }
  });
  if (kind === 'cart' && code && !(await fetchCodes()).some((c) => c.code === code && c.cartDiscounts.some((r) => r.id === id))) await createCode(code, id, rule.name);
  return getDiscount(storeKey, kind, id);
}

/** Active toggle. Switching off keeps the discount listed; activating checks the stored ranges and refuses an unfinished draft. */
export async function setDiscountActive(storeKey: string, kind: DiscountKind, id: string, isActive: boolean): Promise<DiscountDetail> {
  const first = await loadForStore(storeKey, kind, id);
  // W: the store's own co-op discount is Malva-funded (content locked) but its Active switch is the reseller's.
  if (first.malva && !(kind === 'cart' && isOwnCoopDiscount(first.discount as CartDiscount, storeKey))) throw locked();
  if (isActive) {
    if (isDraftKey(first.discount.key)) throw new CatalogError(400, 'DRAFT_INCOMPLETE', 'Complete the rule before activating it');
    const value = first.discount.value;
    const bad = value.type === 'relative' ? !(value.permyriad >= 1 && value.permyriad <= 10000) : value.type === 'absolute' ? value.money.some((m) => !(m.centAmount > 0)) : false;
    if (bad) throw new CatalogError(400, 'INVALID_RULE', 'The discount value is out of range');
    const until = first.discount.validUntil ? Date.parse(first.discount.validUntil) : undefined;
    const from = first.discount.validFrom ? Date.parse(first.discount.validFrom) : undefined;
    if (until !== undefined && from !== undefined && from >= until) throw new CatalogError(400, 'INVALID_RULE', 'The end must be after the start');
  }
  const root = await catalogRoot();
  await retryOnConflict(async () => {
    const { discount } = await loadForStore(storeKey, kind, id);
    const body = { version: discount.version, actions: [{ action: 'changeIsActive' as const, isActive }] };
    if (kind === 'product') await root.productDiscounts().withId({ ID: id }).post({ body }).execute();
    else await root.cartDiscounts().withId({ ID: id }).post({ body }).execute();
  });
  return getDiscount(storeKey, kind, id);
}

export async function deleteDiscount(storeKey: string, kind: DiscountKind, id: string): Promise<void> {
  const first = await loadForStore(storeKey, kind, id);
  if (first.malva) throw locked();
  const root = await catalogRoot();
  await retryOnConflict(async () => {
    const { discount } = await loadForStore(storeKey, kind, id);
    const request = kind === 'product' ? root.productDiscounts().withId({ ID: id }).delete({ queryArgs: { version: discount.version } }) : root.cartDiscounts().withId({ ID: id }).delete({ queryArgs: { version: discount.version } });
    await request.execute();
  });
}

/**
 * Saves the rank of the store's own discounts of a kind. `orderedIds` must be exactly the store's reseller discounts of that
 * kind (409 STALE_LIST otherwise). The store's own sortOrder values are permuted among its discounts, rank 1 getting the value
 * that applies first. sortOrder is unique per kind, so changed discounts first move to free temporary values, then to their final ones.
 */
export async function reorderDiscounts(storeKey: string, kind: DiscountKind, orderedIds: readonly string[]): Promise<{ changed: number }> {
  const own = (await listDiscounts(storeKey, kind)).filter((d) => d.funded === 'store');
  const ids = new Set(orderedIds);
  if (ids.size !== orderedIds.length || ids.size !== own.length || own.some((d) => !ids.has(d.id))) throw new CatalogError(409, 'STALE_LIST', 'The list changed, reload it and try again');
  const target = rankToSortOrders(orderedIds, new Map(own.map((d) => [d.id, d.sortOrder])));
  const changing = own.filter((d) => target.get(d.id) !== d.sortOrder);
  if (changing.length === 0) return { changed: 0 };

  const root = await catalogRoot();
  const held = await heldSortOrders(kind);
  const setOrder = async (id: string, sortOrder: string) =>
    retryOnConflict(async () => {
      const { discount } = await loadForStore(storeKey, kind, id);
      const body = { version: discount.version, actions: [{ action: 'changeSortOrder' as const, sortOrder }] };
      if (kind === 'product') await root.productDiscounts().withId({ ID: id }).post({ body }).execute();
      else await root.cartDiscounts().withId({ ID: id }).post({ body }).execute();
    });
  const temporary = new Map<string, string>();
  for (const d of changing) {
    const value = allocateSortOrder(kind, held, 'reseller');
    held.add(value);
    temporary.set(d.id, value);
  }
  for (const d of changing) await setOrder(d.id, temporary.get(d.id) as string);
  for (const d of changing) await setOrder(d.id, target.get(d.id) as string);
  return { changed: changing.length };
}

/** Funding and band report for the check script and tests: Malva-funded discounts must rank above every reseller discount of the kind. */
export function bandProblems(rows: readonly Pick<DiscountView, 'key' | 'funded' | 'sortOrder'>[]): string[] {
  const problems: string[] = [];
  const reseller = rows.filter((r) => r.funded === 'store');
  for (const m of rows.filter((r) => r.funded === 'malva')) {
    for (const r of reseller) if (!(Number(m.sortOrder) > Number(r.sortOrder))) problems.push(`${m.key} (${m.sortOrder}) does not rank above ${r.key} (${r.sortOrder})`);
    if (!inBand(m.sortOrder, 'malva-funded')) problems.push(`${m.key}: ${m.sortOrder} is outside the Malva-funded band`);
  }
  return problems;
}
