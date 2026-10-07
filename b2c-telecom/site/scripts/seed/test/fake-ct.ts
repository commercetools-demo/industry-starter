// In-memory fake of the commercetools REST surface used by the seed unit tests (F, G and X reuse it).
// It models only what the reconcilers need: key/id lookup, `where` on a few shapes, expand, version checks,
// the update actions of the reconciler table, delete rules (children, published products, product-type use).
import { CtHttpError, type CtApi, type Query } from '../lib';

export type Resource = Record<string, unknown> & { id: string; version: number };
type Obj = Record<string, unknown>;
type Action = Obj & { action: string };

const TYPE_COLLECTION: Record<string, string> = {
  'tax-category': 'tax-categories',
  category: 'categories',
  'product-type': 'product-types',
  zone: 'zones',
  'customer-group': 'customer-groups',
  'cart-discount': 'cart-discounts',
  type: 'types',
  'recurrence-policy': 'recurrence-policies',
  product: 'products',
};

export const SEARCH_PATH = 'products/search';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function arr(value: unknown): Obj[] {
  return Array.isArray(value) ? (value as Obj[]) : [];
}
function httpError(status: number, code: string, message: string): CtHttpError {
  return new CtHttpError(status, message, code);
}

// ---------------------------------------------------------------------------------------------------------------
// where predicates: a(b(c="v")), x="v", x in ("a","b"), joined by "and"

function splitTop(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inString = !inString;
    if (!inString) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth === 0 && text.slice(i, i + sep.length) === sep) {
        parts.push(current.trim());
        current = '';
        i += sep.length - 1;
        continue;
      }
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

function evalCondition(value: unknown, cond: string): boolean {
  if (Array.isArray(value)) return value.some((item) => evalCondition(item, cond));
  if (value === null || typeof value !== 'object') return false;
  const record = value as Obj;
  const nested = /^(\w+)\(([\s\S]*)\)$/.exec(cond);
  if (nested) return evalWhere(record[nested[1]], nested[2]);
  const eq = /^(\w+)\s*=\s*"([\s\S]*)"$/.exec(cond);
  if (eq) return String(record[eq[1]]) === eq[2];
  const inList = /^(\w+)\s+in\s+\(([\s\S]*)\)$/.exec(cond);
  if (inList) {
    const options = inList[2].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    return options.includes(String(record[inList[1]]));
  }
  throw new Error(`fake-ct: unsupported where condition "${cond}"`);
}

function evalWhere(value: unknown, where: string): boolean {
  return splitTop(where, ' and ').every((cond) => evalCondition(value, cond));
}

// ---------------------------------------------------------------------------------------------------------------

export interface FakeOptions {
  project?: Obj;
}

export class FakeCt implements CtApi {
  writes = 0;
  project: Obj;
  readonly collections = new Map<string, Resource[]>();
  /** Every write as a line: `create <coll> <key>`, `update <coll> <key> <action,action>`, `delete <coll> <key>`. */
  readonly log: string[] = [];
  readonly projectUpdates: Obj[] = [];
  /** Throw a 500 on the n-th create (1-based) to simulate an interrupted run. */
  failOnCreate?: number;
  /** Product Search not ready until this many search calls were made. */
  searchReadyAfter = 0;
  searchCalls = 0;
  /** Keys the fake reports as indexed by Product Search. */
  indexedKeys: string[] = [];
  private creates = 0;
  private counter = 0;

  constructor(opts: FakeOptions = {}) {
    this.project = opts.project ?? {
      key: 'spec-test-b2c-telecom',
      version: 1,
      countries: ['GB', 'DE', 'US'],
      currencies: ['EUR', 'GBP', 'USD'],
      languages: ['en-GB', 'de-DE', 'en-US'],
      searchIndexing: { products: { status: 'Deactivated' }, orders: { status: 'Activated' } },
    };
  }

  // test helpers ------------------------------------------------------------------------------------------------

  list(collection: string): Resource[] {
    return this.collections.get(collection) ?? [];
  }
  byKey(collection: string, key: string): Resource | undefined {
    return this.list(collection).find((r) => r.key === key);
  }
  /** Inserts a raw resource without transformation (hand-made data, sample data). */
  seed(collection: string, resource: Obj): Resource {
    const res = { id: `id-${++this.counter}`, version: 1, ...clone(resource) } as Resource;
    if (!this.collections.has(collection)) this.collections.set(collection, []);
    this.collections.get(collection)?.push(res);
    return res;
  }
  keysOf(collection: string): string[] {
    return this.list(collection).map((r) => String(r.key ?? r.id));
  }

  // CtApi -------------------------------------------------------------------------------------------------------

  async get(path: string, query: Query = {}): Promise<unknown | null> {
    const { segments, inlineQuery } = this.parse(path);
    const q: Query = { ...inlineQuery, ...query };
    if (segments.length === 0) return clone(this.project);
    const [collection] = segments;
    if (collection === 'custom-objects' && segments.length === 3) {
      const found = this.list(collection).find((r) => r.container === segments[1] && r.key === segments[2]);
      return found ? clone(found) : null;
    }
    if (segments.length === 1) return this.query(collection, q);
    const res = this.find(collection, segments[1]);
    return res ? this.expand(clone(res), q.expand) : null;
  }

  async post(path: string, body: unknown): Promise<unknown> {
    this.writes += 1;
    const { segments } = this.parse(path);
    const data = body as Obj;
    if (segments.length === 0) return this.updateProject(data);
    const [collection] = segments;
    if (path === SEARCH_PATH) {
      this.writes -= 1;
      return this.search(data);
    }
    if (segments.length === 1) return this.create(collection, data);
    const res = this.find(collection, segments[1]);
    if (!res) throw httpError(404, 'ResourceNotFound', `${collection} ${segments[1]} not found`);
    return this.update(collection, res, data);
  }

  async del(path: string, query: { version: number }): Promise<unknown> {
    this.writes += 1;
    const { segments } = this.parse(path);
    const [collection] = segments;
    const res = this.find(collection, segments[1]);
    if (!res) throw httpError(404, 'ResourceNotFound', `${collection} ${segments[1]} not found`);
    if (res.version !== Number(query.version)) throw httpError(409, 'ConcurrentModification', 'version mismatch');
    this.checkDelete(collection, res);
    this.collections.set(
      collection,
      this.list(collection).filter((r) => r !== res),
    );
    this.log.push(`delete ${collection} ${String(res.key ?? res.sku ?? res.id)}`);
    return clone(res);
  }

  // internals ---------------------------------------------------------------------------------------------------

  private parse(path: string): { segments: string[]; inlineQuery: Query } {
    const [pathname, qs] = path.split('?');
    const inlineQuery: Query = {};
    if (qs) for (const [k, v] of new URLSearchParams(qs)) inlineQuery[k] = v;
    return { segments: pathname.split('/').filter(Boolean), inlineQuery };
  }

  private find(collection: string, idOrKey: string): Resource | undefined {
    if (idOrKey.startsWith('key=')) return this.byKey(collection, idOrKey.slice(4));
    return this.list(collection).find((r) => r.id === idOrKey);
  }

  private query(collection: string, q: Query): unknown {
    let results = this.list(collection);
    const where = q.where;
    if (where) {
      const clauses = Array.isArray(where) ? where : [where];
      results = results.filter((r) => clauses.every((w) => evalWhere(r, String(w))));
    }
    const offset = Number(q.offset ?? 0);
    const limit = Number(q.limit ?? 20);
    const page = results.slice(offset, offset + limit).map((r) => this.expand(clone(r), q.expand));
    return { limit, offset, count: page.length, total: results.length, results: page };
  }

  private expand(resource: Resource, expand: Query[string] | undefined): Resource {
    const paths = expand === undefined ? [] : Array.isArray(expand) ? expand : [String(expand)];
    for (const p of paths) this.expandPath(resource, p.split('.'));
    return resource;
  }

  private expandPath(node: unknown, parts: string[]): void {
    if (node === null || typeof node !== 'object' || parts.length === 0) return;
    const [head, ...rest] = parts;
    const many = head.endsWith('[*]');
    const name = many ? head.slice(0, -3) : head;
    const record = node as Obj;
    const value = record[name];
    const targets = many ? arr(value) : value && typeof value === 'object' ? [value as Obj] : [];
    for (const target of targets) {
      if (rest.length === 0) {
        const coll = TYPE_COLLECTION[String(target.typeId)];
        const found = coll ? this.list(coll).find((r) => r.id === target.id) : undefined;
        if (found) target.obj = clone(found);
      } else this.expandPath(target, rest);
    }
  }

  private resolveRefs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.resolveRefs(v));
    if (value && typeof value === 'object') {
      const o = value as Obj;
      if (typeof o.typeId === 'string' && typeof o.key === 'string' && o.id === undefined) {
        const coll = TYPE_COLLECTION[o.typeId];
        const found = coll ? this.byKey(coll, o.key) : undefined;
        if (!found) throw httpError(400, 'InvalidJsonInput', `Referenced ${o.typeId} with key "${o.key}" does not exist`);
        return { typeId: o.typeId, id: found.id };
      }
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.resolveRefs(v)]));
    }
    return value;
  }

  private updateProject(data: Obj): unknown {
    this.projectUpdates.push(clone(data));
    if (data.version !== this.project.version) throw httpError(409, 'ConcurrentModification', 'version mismatch');
    for (const a of arr(data.actions)) {
      switch (a.action) {
        case 'changeCountries':
          this.project.countries = a.countries;
          break;
        case 'changeCurrencies':
          this.project.currencies = a.currencies;
          break;
        case 'changeLanguages':
          this.project.languages = a.languages;
          break;
        case 'changeProductSearchIndexingEnabled': {
          if (a.mode !== 'ProductsSearch') throw httpError(400, 'InvalidOperation', 'mode not supported');
          const idx = this.project.searchIndexing as { products: { status: string } };
          idx.products.status = a.enabled ? 'Activated' : 'Deactivated';
          break;
        }
        default:
          throw new Error(`fake-ct: unsupported project action ${String(a.action)}`);
      }
    }
    this.project.version = Number(this.project.version) + 1;
    return clone(this.project);
  }

  private search(body: Obj): unknown {
    this.searchCalls += 1;
    const status = (this.project.searchIndexing as { products: { status: string } }).products.status;
    if (status === 'Deactivated' || this.searchCalls <= this.searchReadyAfter) {
      throw httpError(400, 'ObjectNotFound', 'Product Search API is not enabled');
    }
    const or = ((body.query as Obj | undefined)?.or ?? []) as Obj[];
    const wanted = or.map((c) => String((c.exact as Obj).value));
    const hits = wanted.filter((k) => this.indexedKeys.includes(k));
    return { total: hits.length, offset: 0, limit: 1, hits: [] };
  }

  private newResource(data: Obj): Resource {
    return { id: `id-${++this.counter}`, version: 1, createdAt: '2026-10-07T00:00:00.000Z', ...data } as Resource;
  }

  private create(collection: string, rawBody: Obj): unknown {
    this.creates += 1;
    if (this.failOnCreate !== undefined && this.creates === this.failOnCreate) {
      throw httpError(500, 'General', 'simulated failure');
    }
    const body = this.resolveRefs(clone(rawBody)) as Obj;
    if (collection === 'custom-objects') return this.upsertCustomObject(body);
    if (typeof body.key === 'string' && this.byKey(collection, body.key)) {
      throw httpError(400, 'DuplicateField', `A duplicate value "${body.key}" exists for field "key".`);
    }
    const res = this.newResource(this.materialize(collection, body));
    if (!this.collections.has(collection)) this.collections.set(collection, []);
    this.collections.get(collection)?.push(res);
    this.log.push(`create ${collection} ${String(res.key ?? res.sku ?? res.id)}`);
    return clone(res);
  }

  private upsertCustomObject(body: Obj): unknown {
    const existing = this.list('custom-objects').find((r) => r.container === body.container && r.key === body.key);
    if (existing) {
      existing.value = body.value;
      existing.version += 1;
      this.log.push(`update custom-objects ${String(body.key)}`);
      return clone(existing);
    }
    const res = this.seed('custom-objects', body);
    this.log.push(`create custom-objects ${String(body.key)}`);
    return clone(res);
  }

  private materialize(collection: string, body: Obj): Obj {
    switch (collection) {
      case 'customer-groups': {
        const { groupName, ...rest } = body;
        return { ...rest, name: groupName };
      }
      case 'tax-categories':
        return { ...body, rates: arr(body.rates).map((r) => ({ id: `rate-${++this.counter}`, ...r })) };
      case 'categories': {
        const parent = body.parent as Obj | undefined;
        return { ...body, ancestors: this.ancestorsOf(parent) };
      }
      case 'shipping-methods':
        return { ...body, zoneRates: arr(body.zoneRates).map((z) => ({ zone: z.zone, shippingRates: arr(z.shippingRates).map(withTiers) })) };
      case 'discount-codes':
        return body;
      case 'products': {
        const staged = {
          name: body.name,
          slug: body.slug,
          description: body.description,
          categories: body.categories ?? [],
          categoryOrderHints: body.categoryOrderHints ?? {},
          masterVariant: this.variant(1, body.masterVariant as Obj),
          variants: arr(body.variants).map((v, i) => this.variant(i + 2, v)),
        };
        const publish = body.publish === true;
        return {
          key: body.key,
          productType: body.productType,
          taxCategory: body.taxCategory,
          masterData: { published: publish, hasStagedChanges: false, current: clone(staged), staged },
        };
      }
      default:
        return body;
    }
  }

  private variant(id: number, v: Obj): Obj {
    return { id, ...v, attributes: arr(v.attributes), prices: arr(v.prices).map((p) => ({ id: `price-${++this.counter}`, ...p })), images: arr(v.images) };
  }

  private ancestorsOf(parent: Obj | undefined): Obj[] {
    if (!parent) return [];
    const p = this.list('categories').find((c) => c.id === parent.id);
    return [...arr(p?.ancestors), { typeId: 'category', id: parent.id }];
  }

  private update(collection: string, res: Resource, data: Obj): unknown {
    if (data.version !== res.version) throw httpError(409, 'ConcurrentModification', 'version mismatch');
    const actions = arr(data.actions) as Action[];
    const next = clone(res);
    for (const action of actions) this.applyAction(collection, next, this.resolveRefs(action) as Action);
    Object.assign(res, next);
    res.version += 1;
    this.log.push(`update ${collection} ${String(res.key ?? res.sku ?? res.id)} ${actions.map((a) => a.action).join(',')}`);
    return clone(res);
  }

  private checkDelete(collection: string, res: Resource): void {
    if (collection === 'categories' && this.list('categories').some((c) => arr(c.ancestors).some((a) => a.id === res.id))) {
      throw httpError(400, 'InvalidOperation', 'Category has children');
    }
    if (collection === 'products' && (res.masterData as { published: boolean }).published) {
      throw httpError(400, 'InvalidOperation', 'Product must be unpublished before deletion');
    }
    if (collection === 'product-types' && this.list('products').some((p) => (p.productType as Obj).id === res.id)) {
      throw httpError(400, 'InvalidOperation', 'Product type is in use');
    }
  }

  // update actions ----------------------------------------------------------------------------------------------

  private applyAction(collection: string, r: Obj, a: Action): void {
    const set = (field: string, from: string = field): void => {
      r[field] = a[from];
    };
    const unsupported = (): never => {
      throw new Error(`fake-ct: unsupported action ${collection}:${a.action}`);
    };
    switch (collection) {
      case 'types': return this.typeAction(r, a, set, unsupported);
      case 'tax-categories': return this.taxAction(r, a, set, unsupported);
      case 'customer-groups':
        return a.action === 'changeName' ? set('name') : unsupported();
      case 'recurrence-policies':
        if (a.action === 'setName') return set('name');
        if (a.action === 'setDescription') return set('description');
        if (a.action === 'setSchedule') return set('schedule');
        return unsupported();
      case 'product-types': return this.productTypeAction(r, a, set, unsupported);
      case 'categories': return this.categoryAction(r, a, set, unsupported);
      case 'shipping-methods': return this.shippingAction(r, a, set, unsupported);
      case 'cart-discounts': return this.cartDiscountAction(r, a, set, unsupported);
      case 'discount-codes': return this.discountCodeAction(r, a, set, unsupported);
      case 'products': return this.productAction(r, a, unsupported);
      case 'inventory':
        if (a.action === 'changeQuantity') return void (r.quantityOnStock = a.quantity);
        if (a.action === 'setRestockableInDays') return void (r.restockableInDays = a.restockableInDays);
        return unsupported();
      case 'recurring-orders':
        if (a.action === 'setRecurringOrderState') return void (r.recurringOrderState = a.recurringOrderState);
        return unsupported();
      default:
        return unsupported();
    }
  }

  private typeAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    const fields = arr(r.fieldDefinitions);
    const field = (name: unknown): Obj => fields.find((f) => f.name === name) ?? unsupported();
    switch (a.action) {
      case 'changeName': return set('name');
      case 'addFieldDefinition': return void (r.fieldDefinitions = [...fields, a.fieldDefinition]);
      case 'changeLabel': return void (field(a.fieldName).label = a.label);
      case 'changeFieldDefinitionOrder':
        return void (r.fieldDefinitions = (a.fieldNames as string[]).map((n) => field(n)));
      case 'addEnumValue':
      case 'addLocalizedEnumValue': {
        const t = field(a.fieldName).type as { values: unknown[] };
        return void t.values.push(a.value);
      }
      case 'changeEnumValueLabel':
      case 'changeLocalizedEnumValueLabel': {
        const t = field(a.fieldName).type as { values: Obj[] };
        const v = a.value as Obj;
        const target = t.values.find((x) => x.key === v.key) ?? unsupported();
        target.label = v.label;
        return;
      }
      default: return unsupported();
    }
  }

  private taxAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    const rates = arr(r.rates);
    switch (a.action) {
      case 'changeName': return set('name');
      case 'setDescription': return set('description');
      case 'addTaxRate': return void (r.rates = [...rates, { id: `rate-${++this.counter}`, ...(a.taxRate as Obj) }]);
      case 'replaceTaxRate':
        return void (r.rates = rates.map((x) => (x.id === a.taxRateId ? { ...(a.taxRate as Obj), id: x.id } : x)));
      case 'removeTaxRate': return void (r.rates = rates.filter((x) => x.id !== a.taxRateId));
      default: return unsupported();
    }
  }

  private productTypeAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    const attrs = arr(r.attributes);
    const attr = (name: unknown): Obj => attrs.find((x) => x.name === name) ?? unsupported();
    const enumValues = (name: unknown): unknown[] => {
      const t = attr(name).type as Obj;
      const inner = (t.name === 'set' ? t.elementType : t) as { values: unknown[] };
      return inner.values;
    };
    switch (a.action) {
      case 'changeName': return set('name');
      case 'changeDescription': return set('description');
      case 'addAttributeDefinition': return void (r.attributes = [...attrs, { level: 'Variant', attributeConstraint: 'None', inputHint: 'SingleLine', isSearchable: true, savedToLineItem: false, ...(a.attribute as Obj) }]);
      case 'changeLabel': return void (attr(a.attributeName).label = a.label);
      case 'setInputTip': return void (attr(a.attributeName).inputTip = a.inputTip);
      case 'changeInputHint': return void (attr(a.attributeName).inputHint = a.newValue);
      case 'changeIsSearchable': return void (attr(a.attributeName).isSearchable = a.isSearchable);
      case 'changeSavedToLineItem': return void (attr(a.attributeName).savedToLineItem = a.savedToLineItem);
      case 'changeAttributeConstraint': return void (attr(a.attributeName).attributeConstraint = a.newValue);
      case 'addPlainEnumValue':
      case 'addLocalizedEnumValue': return void enumValues(a.attributeName).push(a.value);
      case 'changePlainEnumValueLabel':
      case 'changeLocalizedEnumValueLabel': {
        const nv = a.newValue as Obj;
        const target = (enumValues(a.attributeName) as Obj[]).find((v) => v.key === nv.key) ?? unsupported();
        return void (target.label = nv.label);
      }
      case 'changeAttributeOrderByName':
        return void (r.attributes = (a.attributeNames as string[]).map((n) => attr(n)));
      default: return unsupported();
    }
  }

  private categoryAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    switch (a.action) {
      case 'changeName': return set('name');
      case 'changeSlug': return set('slug');
      case 'setDescription': return set('description');
      case 'changeOrderHint': return set('orderHint');
      case 'changeParent':
        r.parent = a.parent;
        r.ancestors = this.ancestorsOf(a.parent as Obj);
        return;
      default: return unsupported();
    }
  }

  private shippingAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    const zoneRates = arr(r.zoneRates);
    const zoneId = (z: unknown): unknown => (z as Obj).id;
    const forZone = (z: unknown): Obj => zoneRates.find((x) => zoneId(x.zone) === zoneId(z)) ?? unsupported();
    switch (a.action) {
      case 'changeName': return set('name');
      case 'setLocalizedName': return set('localizedName');
      case 'setLocalizedDescription': return set('localizedDescription');
      case 'changeTaxCategory': return set('taxCategory');
      case 'changeIsDefault': return set('isDefault');
      case 'changeActive': return set('active');
      case 'setPredicate': return set('predicate');
      case 'addZone': return void (r.zoneRates = [...zoneRates, { zone: a.zone, shippingRates: [] }]);
      case 'removeZone': return void (r.zoneRates = zoneRates.filter((x) => zoneId(x.zone) !== zoneId(a.zone)));
      case 'addShippingRate': {
        const z = forZone(a.zone);
        z.shippingRates = [...arr(z.shippingRates), withTiers(a.shippingRate as Obj)];
        return;
      }
      case 'removeShippingRate': {
        const z = forZone(a.zone);
        const price = (a.shippingRate as Obj).price as Obj;
        z.shippingRates = arr(z.shippingRates).filter((s) => !((s.price as Obj).currencyCode === price.currencyCode));
        return;
      }
      default: return unsupported();
    }
  }

  private cartDiscountAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    switch (a.action) {
      case 'changeName': case 'changeValue': case 'changeCartPredicate': case 'changeTarget': case 'changeSortOrder':
      case 'changeStackingMode': case 'changeIsActive': case 'changeRequiresDiscountCode': case 'setDescription':
      case 'setRecurringOrderScope': {
        const field = a.action === 'setRecurringOrderScope' ? 'recurringOrderScope' : a.action === 'setDescription' ? 'description' : a.action.replace(/^change/, '').replace(/^./, (c) => c.toLowerCase());
        return void (r[field] = a[field]);
      }
      case 'setValidFromAndUntil': r.validFrom = a.validFrom; r.validUntil = a.validUntil; return;
      default: return unsupported();
    }
  }

  private discountCodeAction(r: Obj, a: Action, set: (f: string, from?: string) => void, unsupported: () => never): void {
    switch (a.action) {
      case 'setName': return set('name');
      case 'setDescription': return set('description');
      case 'changeCartDiscounts': return set('cartDiscounts');
      case 'setCartPredicate': return set('cartPredicate');
      case 'changeIsActive': return set('isActive');
      case 'setMaxApplications': return set('maxApplications');
      case 'setMaxApplicationsPerCustomer': return set('maxApplicationsPerCustomer');
      case 'setValidFromAndUntil': r.validFrom = a.validFrom; r.validUntil = a.validUntil; return;
      default: return unsupported();
    }
  }

  private productAction(r: Obj, a: Action, unsupported: () => never): void {
    const md = r.masterData as { published: boolean; hasStagedChanges: boolean; current: Obj; staged: Obj };
    const staged = md.staged;
    const variants = (): Obj[] => [staged.masterVariant as Obj, ...arr(staged.variants)];
    const bySku = (sku: unknown): Obj => variants().find((v) => v.sku === sku) ?? unsupported();
    switch (a.action) {
      case 'publish':
        md.current = clone(staged);
        md.published = true;
        md.hasStagedChanges = false;
        return;
      case 'unpublish':
        md.published = false;
        return;
      default:
        md.hasStagedChanges = true;
    }
    switch (a.action) {
      case 'changeName': return void (staged.name = a.name);
      case 'changeSlug': return void (staged.slug = a.slug);
      case 'setDescription': return void (staged.description = a.description);
      case 'addToCategory': {
        staged.categories = [...arr(staged.categories), a.category];
        if (a.orderHint) (staged.categoryOrderHints as Obj)[String((a.category as Obj).id)] = a.orderHint;
        return;
      }
      case 'removeFromCategory':
        staged.categories = arr(staged.categories).filter((c) => c.id !== (a.category as Obj).id);
        return;
      case 'setCategoryOrderHint': {
        const hints = staged.categoryOrderHints as Obj;
        if (a.orderHint) hints[String(a.categoryId)] = a.orderHint;
        else delete hints[String(a.categoryId)];
        return;
      }
      case 'setTaxCategory': return void (r.taxCategory = a.taxCategory);
      case 'addVariant': {
        const id = variants().length + 1;
        staged.variants = [...arr(staged.variants), this.variant(id, a as Obj)];
        return;
      }
      case 'removeVariant': staged.variants = arr(staged.variants).filter((v) => v.sku !== a.sku); return;
      case 'setAttribute': {
        const v = bySku(a.sku);
        const rest = arr(v.attributes).filter((x) => x.name !== a.name);
        v.attributes = a.value === undefined ? rest : [...rest, { name: a.name, value: a.value }];
        return;
      }
      case 'setPrices': bySku(a.sku).prices = arr(a.prices).map((p) => ({ id: `price-${++this.counter}`, ...p })); return;
      case 'addExternalImage': {
        const v = bySku(a.sku);
        v.images = [...arr(v.images), a.image];
        return;
      }
      case 'removeImage': {
        const v = bySku(a.sku);
        v.images = arr(v.images).filter((i) => i.url !== a.imageUrl);
        return;
      }
      default: return unsupported();
    }
  }
}

function withTiers(rate: Obj): Obj {
  return { tiers: [], ...rate };
}
