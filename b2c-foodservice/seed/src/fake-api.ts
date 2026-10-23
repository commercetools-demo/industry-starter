// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, ProjectView, Res } from './api';

/**
 * In-memory stand-in for the commercetools API, used by the offline unit tests and by `seed --dry-run --offline`.
 * It mimics what matters for the seed: ids and versions (a stale version is rejected with 409), key lookup, reference
 * resolution (an unknown key reference is rejected like a 400, which proves step ORDER), referential integrity on
 * delete (a referenced resource cannot be deleted, which proves cleanup ORDER), product reviewRatingStatistics computed
 * deterministically from the approved reviews, and the update actions the seed emits. An update action it does not
 * know throws, so a new action in the seed forces the fake to learn it.
 */
const REF_KIND: Record<string, Kind> = {
  category: 'categories', 'product-type': 'product-types', 'tax-category': 'tax-categories', zone: 'zones', channel: 'channels',
  type: 'types', customer: 'customers', product: 'products', review: 'reviews', state: 'states', 'cart-discount': 'cart-discounts',
  'product-discount': 'product-discounts', 'recurrence-policy': 'recurrence-policies', 'shipping-method': 'shipping-methods',
};

export class ApiError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

type Obj = Record<string, unknown>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

interface StoredVariant { id: number; sku?: string; key?: string; attributes?: Obj[]; prices?: Obj[]; recurrencePrices?: Obj[]; images?: Obj[] }

export class FakeApi implements Api {
  readonly data = new Map<Kind, Map<string, Res>>();
  project: ProjectView = {
    key: 'fake', version: 1, languages: ['en-US'], countries: ['US', 'ES'], currencies: ['USD', 'CHF'],
    searchIndexing: { productsSearch: { status: 'Deactivated' } }, carts: { countryTaxRateFallbackEnabled: false },
  };
  /** Number of write calls (create, update, remove). A re-run of an idempotent seed leaves this unchanged. */
  writes = 0;
  /** Number of read calls. `reads + writes` is the number of requests a real API would have seen. */
  reads = 0;
  private n = 0;

  get requests(): number {
    return this.reads + this.writes;
  }

  private bucket(kind: Kind): Map<string, Res> {
    let b = this.data.get(kind);
    if (!b) this.data.set(kind, (b = new Map()));
    return b;
  }

  /** Test helper: seed pre-existing resources (the project's sample data). */
  put(kind: Kind, res: Omit<Res, 'id' | 'version'> & { id?: string; version?: number }): Res {
    const stored = { version: 1, id: `${kind}-${(this.n += 1)}`, ...res } as Res;
    this.bucket(kind).set(stored.id, stored);
    return stored;
  }

  all(kind: Kind): Res[] {
    return [...this.bucket(kind).values()];
  }

  async getByKey(kind: Kind, key: string): Promise<Res | undefined> {
    this.reads += 1;
    const found = this.all(kind).find((r) => r.key === key);
    return found ? clone(found) : undefined;
  }

  async getById(kind: Kind, id: string): Promise<Res | undefined> {
    this.reads += 1;
    const found = this.bucket(kind).get(id);
    return found ? clone(found) : undefined;
  }

  async list(kind: Kind, opts?: { where?: string }): Promise<Res[]> {
    this.reads += 1;
    const sku = opts?.where?.match(/^sku="([^"]+)"$/)?.[1];
    return this.all(kind).filter((r) => !sku || r.sku === sku).map(clone);
  }

  private resolve<T>(value: T): T {
    const walk = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const o = v as Obj;
        if (typeof o.typeId === 'string' && typeof o.key === 'string' && o.id === undefined) {
          const kind = REF_KIND[o.typeId];
          if (!kind) throw new ApiError(400, `FakeApi: unknown reference type ${o.typeId}`);
          const target = this.all(kind).find((r) => r.key === o.key);
          if (!target) throw new ApiError(400, `ReferencedResourceNotFound: ${o.typeId} with key ${o.key}`);
          return { typeId: o.typeId, id: target.id };
        }
        return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)]));
      }
      return v;
    };
    return walk(value) as T;
  }

  private variantOf(d: Obj, id: number): StoredVariant {
    const prices = (d.prices as Obj[] | undefined) ?? [];
    return {
      ...(d as unknown as StoredVariant), id,
      prices: prices.filter((p) => !p.recurrencePolicy), recurrencePrices: prices.filter((p) => !!p.recurrencePolicy),
    };
  }

  async create(kind: Kind, body: Obj): Promise<Res> {
    const key = body.key as string | undefined;
    if (key && this.all(kind).some((r) => r.key === key)) throw new ApiError(400, `DuplicateField: key ${key} already exists in ${kind}`);
    const unique = body.uniquenessValue as string | undefined;
    if (kind === 'reviews' && unique && this.all(kind).some((r) => r.uniquenessValue === unique)) throw new ApiError(400, `DuplicateField: uniquenessValue ${unique} already exists in reviews`);
    if (kind === 'shipping-methods' && body.isDefault === true && this.all(kind).some((r) => r.isDefault === true)) throw new ApiError(400, "DuplicateField: A duplicate value 'true' exists for field 'isDefault'.");
    if (kind === 'zones') {
      const mine = ((body.locations as Obj[] | undefined) ?? []).map((l) => `${l.country}/${l.state ?? ''}`);
      for (const z of this.all('zones')) for (const l of ((z.locations as Obj[] | undefined) ?? [])) if (mine.includes(`${l.country}/${l.state ?? ''}`)) throw new ApiError(400, `DuplicateField: a duplicate value '{"country":"${String(l.country)}"}' exists for field 'location'`);
    }
    const resolved = this.resolve(clone(body));
    const id = `${kind}-${(this.n += 1)}`;
    let stored: Res = { ...resolved, id, version: 1 } as Res;
    delete stored.password;
    if (kind === 'products') {
      const mv = this.variantOf(resolved.masterVariant as Obj, 1);
      const variants = ((resolved.variants as Obj[]) ?? []).map((v, i) => this.variantOf(v, i + 2));
      const projection = { name: resolved.name, slug: resolved.slug, description: resolved.description, categories: resolved.categories ?? [], masterVariant: mv, variants, searchKeywords: resolved.searchKeywords };
      const published = resolved.publish === true;
      stored = {
        id, version: 1, key, priceMode: resolved.priceMode ?? 'Embedded', productType: resolved.productType, taxCategory: resolved.taxCategory,
        masterData: { published, hasStagedChanges: false, current: published ? clone(projection) : {}, staged: projection },
      } as Res;
    }
    if (kind === 'categories') {
      const parent = (resolved.parent as { id: string } | undefined)?.id;
      const parentRes = parent ? this.bucket('categories').get(parent) : undefined;
      stored.ancestors = parent ? [...((parentRes?.ancestors as unknown[]) ?? []), { typeId: 'category', id: parent }] : [];
    }
    if (kind === 'tax-categories') stored.rates = ((resolved.rates as Obj[]) ?? []).map((r) => ({ ...r, id: `rate-${(this.n += 1)}` }));
    if (kind === 'states') {
      stored.builtIn = false;
      stored.initial ??= false;
    }
    if (kind === 'reviews') {
      stored.createdAt = '2026-10-19T00:00:00.000Z';
      stored.includedInStatistics = this.included(stored);
    }
    if (kind === 'shopping-lists') stored.lineItems = ((resolved.lineItems as Obj[]) ?? []).map((l, i) => ({ ...l, id: `li-${i + 1}` }));
    this.bucket(kind).set(id, stored);
    this.writes += 1;
    if (kind === 'reviews') this.recomputeStatistics((stored.target as { id: string } | undefined)?.id);
    return clone(stored);
  }

  /** includedInStatistics: a review without state counts, otherwise its state needs the role ReviewIncludedInStatistics. */
  private included(r: Res): boolean {
    if (r.rating === undefined) return false;
    const stateId = (r.state as { id: string } | undefined)?.id;
    if (!stateId) return true;
    return (((this.bucket('states').get(stateId)?.roles as string[]) ?? []).includes('ReviewIncludedInStatistics'));
  }

  private recomputeStatistics(productId?: string): void {
    if (!productId) return;
    const product = this.bucket('products').get(productId);
    if (!product) return;
    const ratings = this.all('reviews').filter((r) => (r.target as { id: string } | undefined)?.id === productId && this.included(r)).map((r) => r.rating as number);
    if (ratings.length === 0) {
      delete product.reviewRatingStatistics;
      return;
    }
    const dist: Record<string, number> = {};
    for (const x of ratings) dist[String(x)] = (dist[String(x)] ?? 0) + 1;
    product.reviewRatingStatistics = {
      averageRating: ratings.reduce((s, x) => s + x, 0) / ratings.length, highestRating: Math.max(...ratings), lowestRating: Math.min(...ratings),
      count: ratings.length, ratingsDistribution: dist,
    };
  }

  async update(kind: Kind, res: { id: string; version: number }, actions: Obj[]): Promise<Res> {
    const stored = this.bucket(kind).get(res.id);
    if (!stored) throw new ApiError(404, `${kind} ${res.id} not found`);
    if (stored.version !== res.version) throw new ApiError(409, `ConcurrentModification on ${kind} ${res.id}: have ${stored.version}, got ${res.version}`);
    for (const a of actions) this.apply(kind, stored, this.resolve(clone(a)));
    stored.version += 1;
    this.writes += 1;
    if (kind === 'reviews') {
      stored.includedInStatistics = this.included(stored);
      this.recomputeStatistics((stored.target as { id: string } | undefined)?.id);
    }
    return clone(stored);
  }

  private variant(md: { staged: Obj }, a: Obj): StoredVariant {
    const staged = md.staged as { masterVariant: StoredVariant; variants: StoredVariant[] };
    const all = [staged.masterVariant, ...staged.variants];
    const v = all.find((x) => (a.sku !== undefined ? x.sku === a.sku : x.id === a.variantId));
    if (!v) throw new ApiError(400, `FakeApi: variant not found (${String(a.sku ?? a.variantId)})`);
    return v;
  }

  private apply(kind: Kind, r: Res, a: Obj): void {
    const act = a.action as string;
    if (act === 'setKey') { r.key = a.key as string; return; }
    const set = (field: string, value: unknown) => { r[field] = value; };
    const md = r.masterData as { published: boolean; hasStagedChanges: boolean; current: Obj; staged: Obj } | undefined;
    switch (`${kind}:${act}`) {
      case 'products:changeName': (md as { staged: Obj }).staged.name = a.name; return;
      case 'products:setDescription': (md as { staged: Obj }).staged.description = a.description; return;
      case 'products:setPrices': {
        const v = this.variant(md as { staged: Obj }, a);
        const prices = (a.prices as Obj[]) ?? [];
        v.prices = prices.filter((p) => !p.recurrencePolicy);
        v.recurrencePrices = prices.filter((p) => !!p.recurrencePolicy);
        return;
      }
      case 'products:setAttribute': {
        const v = this.variant(md as { staged: Obj }, a);
        const attrs = v.attributes ?? [];
        const i = attrs.findIndex((x) => x.name === a.name);
        if (i >= 0) attrs[i] = { name: a.name, value: a.value }; else attrs.push({ name: a.name, value: a.value });
        v.attributes = attrs;
        return;
      }
      case 'products:addExternalImage': { const v = this.variant(md as { staged: Obj }, a); v.images = [...(v.images ?? []), a.image as Obj]; return; }
      case 'products:removeImage': { const v = this.variant(md as { staged: Obj }, a); v.images = (v.images ?? []).filter((i) => i.url !== a.imageUrl); return; }
      case 'products:publish': (md as { current: Obj }).current = clone((md as { staged: Obj }).staged); (md as { published: boolean }).published = true; return;
      case 'products:unpublish': (md as { published: boolean }).published = false; return;
      case 'categories:changeName': set('name', a.name); return;
      case 'categories:addAsset': set('assets', [...((r.assets as unknown[]) ?? []), a.asset]); return;
      case 'channels:changeName': set('name', a.name); return;
      case 'channels:setCustomField': {
        const custom = (r.custom as { fields: Obj } | undefined) ?? { fields: {} };
        custom.fields[a.name as string] = a.value;
        set('custom', custom);
        return;
      }
      case 'inventory:changeQuantity': set('quantityOnStock', a.quantity); return;
      case 'product-discounts:changeSortOrder': case 'cart-discounts:changeSortOrder': set('sortOrder', a.sortOrder); return;
      case 'product-discounts:changeIsActive': case 'cart-discounts:changeIsActive': set('isActive', a.isActive); return;
      case 'product-discounts:changePredicate': set('predicate', a.predicate); return;
      case 'cart-discounts:changeCartPredicate': set('cartPredicate', a.cartPredicate); return;
      case 'reviews:setRating': set('rating', a.rating); return;
      case 'reviews:setTitle': set('title', a.title); return;
      case 'reviews:setText': set('text', a.text); return;
      case 'reviews:setState': set('state', a.state); return;
      case 'states:setName': set('name', a.name); return;
      case 'states:setRoles': set('roles', a.roles); return;
      case 'states:setTransitions': set('transitions', a.transitions); return;
      case 'tax-categories:addTaxRate': set('rates', [...((r.rates as unknown[]) ?? []), { ...(a.taxRate as Obj), id: `rate-${(this.n += 1)}` }]); return;
      case 'tax-categories:replaceTaxRate': set('rates', ((r.rates as Obj[]) ?? []).map((x) => (x.id === a.taxRateId ? { ...(a.taxRate as Obj), id: x.id } : x))); return;
      case 'shipping-methods:addZone': set('zoneRates', [...((r.zoneRates as unknown[]) ?? []), { zone: a.zone, shippingRates: [] }]); return;
      case 'shipping-methods:addShippingRate': {
        const zr = ((r.zoneRates as { zone: { id: string }; shippingRates: Obj[] }[]) ?? []).find((z) => z.zone.id === (a.zone as { id: string }).id);
        if (!zr) throw new ApiError(400, 'FakeApi: zone not on shipping method');
        zr.shippingRates.push(a.shippingRate as Obj);
        return;
      }
      case 'shipping-methods:removeShippingRate': {
        const zr = ((r.zoneRates as { zone: { id: string }; shippingRates: { price: { currencyCode: string } }[] }[]) ?? []).find((z) => z.zone.id === (a.zone as { id: string }).id);
        if (zr) zr.shippingRates = zr.shippingRates.filter((s) => s.price.currencyCode !== ((a.shippingRate as { price: { currencyCode: string } }).price.currencyCode));
        return;
      }
      case 'types:addFieldDefinition': set('fieldDefinitions', [...((r.fieldDefinitions as unknown[]) ?? []), a.fieldDefinition]); return;
      case 'product-types:addAttributeDefinition': set('attributes', [...((r.attributes as unknown[]) ?? []), a.attribute]); return;
      default: throw new Error(`FakeApi: unsupported action ${kind}:${act}`);
    }
  }

  async remove(kind: Kind, res: { id: string; version: number }): Promise<void> {
    const stored = this.bucket(kind).get(res.id);
    if (!stored) throw new ApiError(404, `${kind} ${res.id} not found`);
    if (stored.version !== res.version) throw new ApiError(409, `ConcurrentModification on ${kind} ${res.id}`);
    if (kind === 'products' && (stored.masterData as { published: boolean }).published) throw new ApiError(400, `product ${stored.key} must be unpublished before delete`);
    for (const [otherKind, bucket] of this.data) {
      for (const other of bucket.values()) {
        if (other.id === res.id) continue;
        if (JSON.stringify(other).includes(`"id":"${res.id}"`)) throw new ApiError(400, `ReferenceExists: ${kind} ${stored.key ?? res.id} is referenced by ${otherKind} ${other.key ?? other.id}`);
      }
    }
    this.bucket(kind).delete(res.id);
    this.writes += 1;
    if (kind === 'reviews') this.recomputeStatistics((stored.target as { id: string } | undefined)?.id);
  }

  async verifyCustomerEmail(res: { id: string; version: number }): Promise<void> {
    const c = this.all('customers').find((x) => x.id === res.id);
    if (!c) throw new ApiError(404, `customer ${res.id} not found`);
    c.isEmailVerified = true;
    c.version += 1;
    this.writes += 1;
  }

  async getProject(): Promise<ProjectView> {
    this.reads += 1;
    return clone(this.project);
  }

  async updateProject(version: number, actions: Obj[]): Promise<ProjectView> {
    if (version !== this.project.version) throw new ApiError(409, 'ConcurrentModification on project');
    for (const a of actions) {
      if (a.action === 'changeProductSearchIndexingEnabled') this.project.searchIndexing = { productsSearch: { status: a.enabled ? 'Activated' : 'Deactivated' } };
      else if (a.action === 'changeCountryTaxRateFallbackEnabled') this.project.carts = { countryTaxRateFallbackEnabled: a.countryTaxRateFallbackEnabled as boolean };
      else if (a.action === 'changeLanguages') this.project.languages = a.languages as string[];
      else if (a.action === 'changeCountries') this.project.countries = a.countries as string[];
      else if (a.action === 'changeCurrencies') this.project.currencies = a.currencies as string[];
      else throw new Error(`FakeApi: unsupported project action ${String(a.action)}`);
    }
    this.project.version += 1;
    this.writes += 1;
    return clone(this.project);
  }
}
