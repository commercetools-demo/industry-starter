// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, ProjectView, Res } from './api';

/**
 * In-memory stand-in for the commercetools API, used by the offline unit tests and by `seed --dry-run --offline`.
 * It mimics what matters for the seed: ids and versions (a stale version is rejected with 409), key lookup, reference
 * resolution (an unknown key reference is rejected like a 400, which proves step ORDER), referential integrity on
 * delete (a referenced resource cannot be deleted, which proves cleanup ORDER), and the update actions the seed emits.
 * An update action it does not know throws, so a new action in the seed forces the fake to learn it.
 */
const REF_KIND: Record<string, Kind> = {
  category: 'categories', 'product-type': 'product-types', 'tax-category': 'tax-categories', zone: 'zones', channel: 'channels',
  'customer-group': 'customer-groups', type: 'types', store: 'stores', 'product-selection': 'product-selections',
  'associate-role': 'associate-roles', 'business-unit': 'business-units', customer: 'customers', product: 'products',
  review: 'reviews', 'cart-discount': 'cart-discounts', 'product-discount': 'product-discounts', 'recurrence-policy': 'recurrence-policies',
};

export class ApiError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

type Obj = Record<string, unknown>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export class FakeApi implements Api {
  readonly data = new Map<Kind, Map<string, Res>>();
  readonly objects = new Map<string, { container: string; key: string; value: unknown; version: number }>();
  readonly memberships = new Map<string, string[]>();
  project: ProjectView = {
    key: 'fake', version: 1, languages: ['en-US', 'de-DE', 'en-GB'], countries: ['GB', 'DE', 'US', 'ES', 'FR'], currencies: ['EUR', 'GBP', 'USD'],
    searchIndexing: { productsSearch: { status: 'Deactivated' } }, carts: { countryTaxRateFallbackEnabled: true },
  };
  /** Number of write calls (create, update, remove, put). A re-run of an idempotent seed leaves this unchanged. */
  writes = 0;
  private n = 0;

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
    const found = this.all(kind).find((r) => r.key === key);
    return found ? clone(found) : undefined;
  }

  async getById(kind: Kind, id: string): Promise<Res | undefined> {
    const found = this.bucket(kind).get(id);
    return found ? clone(found) : undefined;
  }

  async list(kind: Kind, opts?: { where?: string }): Promise<Res[]> {
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

  async create(kind: Kind, body: Obj, opts?: { store?: string }): Promise<Res> {
    const key = body.key as string | undefined;
    if (key && this.all(kind).some((r) => r.key === key)) throw new ApiError(400, `DuplicateField: key ${key} already exists in ${kind}`);
    if (opts?.store && !this.all('stores').some((s) => s.key === opts.store)) throw new ApiError(404, `store ${opts.store} not found`);
    const resolved = this.resolve(clone(body));
    const id = `${kind}-${(this.n += 1)}`;
    let stored: Res = { ...resolved, id, version: 1 } as Res;
    delete stored.password;
    if (kind === 'products') {
      const mv = { ...(resolved.masterVariant as Obj), id: 1 };
      const projection = { name: resolved.name, slug: resolved.slug, description: resolved.description, categories: resolved.categories ?? [], masterVariant: mv, variants: [], searchKeywords: resolved.searchKeywords };
      const published = resolved.publish === true;
      stored = { id, version: 1, key, priceMode: resolved.priceMode ?? 'Embedded', productType: resolved.productType, taxCategory: resolved.taxCategory, masterData: { published, hasStagedChanges: false, current: published ? clone(projection) : {}, staged: projection } } as Res;
    }
    if (kind === 'categories') {
      const parent = (resolved.parent as { id: string } | undefined)?.id;
      const parentRes = parent ? this.bucket('categories').get(parent) : undefined;
      stored.ancestors = parent ? [...((parentRes?.ancestors as unknown[]) ?? []), { typeId: 'category', id: parent }] : [];
    }
    if (kind === 'stores') {
      stored.distributionChannels ??= []; stored.supplyChannels ??= []; stored.productSelections ??= []; stored.countries ??= []; stored.languages ??= [];
    }
    if (kind === 'product-tailoring') {
      const t = { name: resolved.name, description: resolved.description, variants: resolved.variants ?? [] };
      stored = { id, version: 1, key, product: resolved.product, store: opts?.store, published: resolved.publish === true, current: resolved.publish === true ? clone(t) : {}, staged: t } as Res;
    }
    if (kind === 'business-units') stored.associates ??= [];
    this.bucket(kind).set(id, stored);
    this.writes += 1;
    return clone(stored);
  }

  async update(kind: Kind, res: { id: string; version: number }, actions: Obj[]): Promise<Res> {
    const stored = this.bucket(kind).get(res.id);
    if (!stored) throw new ApiError(404, `${kind} ${res.id} not found`);
    if (stored.version !== res.version) throw new ApiError(409, `ConcurrentModification on ${kind} ${res.id}: have ${stored.version}, got ${res.version}`);
    for (const a of actions) this.apply(kind, stored, this.resolve(clone(a)));
    stored.version += 1;
    this.writes += 1;
    return clone(stored);
  }

  private apply(kind: Kind, r: Res, a: Obj): void {
    const act = a.action as string;
    const set = (field: string, value: unknown) => { r[field] = value; };
    const md = r.masterData as { published: boolean; hasStagedChanges: boolean; current: Obj; staged: Obj } | undefined;
    const mv = md?.staged.masterVariant as Obj | undefined;
    switch (`${kind}:${act}`) {
      case 'products:changeName': (md as { staged: Obj }).staged.name = a.name; return;
      case 'products:setDescription': (md as { staged: Obj }).staged.description = a.description; return;
      case 'products:setPrices': (mv as Obj).prices = a.prices; return;
      case 'products:setAttribute': {
        const attrs = ((mv as Obj).attributes as { name: string; value: unknown }[]) ?? [];
        const i = attrs.findIndex((x) => x.name === a.name);
        if (i >= 0) attrs[i] = { name: a.name as string, value: a.value }; else attrs.push({ name: a.name as string, value: a.value });
        (mv as Obj).attributes = attrs;
        return;
      }
      case 'products:addExternalImage': ((mv as Obj).images as unknown[]) = [...(((mv as Obj).images as unknown[]) ?? []), a.image]; return;
      case 'products:removeImage': (mv as Obj).images = (((mv as Obj).images as { url: string }[]) ?? []).filter((i) => i.url !== a.imageUrl); return;
      case 'products:publish': (md as { current: Obj }).current = clone((md as { staged: Obj }).staged); (md as { published: boolean }).published = true; return;
      case 'products:unpublish': (md as { published: boolean }).published = false; return;
      case 'categories:changeName': set('name', a.name); return;
      case 'channels:changeName': set('name', a.name); return;
      case 'stores:setName': set('name', a.name); return;
      case 'stores:setLanguages': set('languages', a.languages); return;
      case 'stores:setCountries': set('countries', a.countries); return;
      case 'stores:setDistributionChannels': set('distributionChannels', a.distributionChannels); return;
      case 'stores:setSupplyChannels': set('supplyChannels', a.supplyChannels); return;
      case 'stores:setProductSelections': set('productSelections', a.productSelections); return;
      case 'associate-roles:setPermissions': set('permissions', a.permissions); return;
      case 'product-selections:addProduct': {
        const id = (a.product as { id: string }).id;
        this.memberships.set(r.id, [...new Set([...(this.memberships.get(r.id) ?? []), id])]);
        return;
      }
      case 'product-selections:removeProduct': this.memberships.set(r.id, (this.memberships.get(r.id) ?? []).filter((x) => x !== (a.product as { id: string }).id)); return;
      case 'inventory:changeQuantity': set('quantityOnStock', a.quantity); return;
      case 'product-discounts:changeSortOrder': case 'cart-discounts:changeSortOrder': set('sortOrder', a.sortOrder); return;
      case 'product-discounts:changeIsActive': case 'cart-discounts:changeIsActive': set('isActive', a.isActive); return;
      case 'cart-discounts:setStores': set('stores', a.stores); return;
      case 'reviews:setRating': set('rating', a.rating); return;
      case 'reviews:setTitle': set('title', a.title); return;
      case 'reviews:setText': set('text', a.text); return;
      case 'product-discounts:changePredicate': set('predicate', a.predicate); return;
      case 'cart-discounts:changeCartPredicate': set('cartPredicate', a.cartPredicate); return;
      case 'business-units:changeName': set('name', a.name); return;
      case 'business-units:addAssociate': set('associates', [...((r.associates as unknown[]) ?? []), a.associate]); return;
      case 'types:addFieldDefinition': set('fieldDefinitions', [...((r.fieldDefinitions as unknown[]) ?? []), a.fieldDefinition]); return;
      case 'product-types:addAttributeDefinition': set('attributes', [...((r.attributes as unknown[]) ?? []), a.attribute]); return;
      case 'product-tailoring:setName': (r.staged as Obj).name = a.name; return;
      case 'product-tailoring:setDescription': (r.staged as Obj).description = a.description; return;
      case 'product-tailoring:setExternalImages': {
        const staged = r.staged as { variants?: { sku?: string; images?: unknown[] }[] };
        const variants = staged.variants ?? [];
        const v = variants.find((x) => x.sku === a.sku);
        if (v) v.images = a.images as unknown[]; else variants.push({ sku: a.sku as string, images: a.images as unknown[] });
        staged.variants = variants;
        return;
      }
      case 'standalone-prices:changeValue': set('value', a.value); return;
      case 'product-tailoring:publish': r.current = clone(r.staged); r.published = true; return;
      case 'categories:setAssets': set('assets', a.assets); return;
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
        if (otherKind === 'products' && kind === 'categories') {
          // products reference categories in both projections
        }
        if (JSON.stringify(other).includes(`"id":"${res.id}"`)) throw new ApiError(400, `ReferenceExists: ${kind} ${stored.key ?? res.id} is referenced by ${otherKind} ${other.key ?? other.id}`);
      }
    }
    this.bucket(kind).delete(res.id);
    this.writes += 1;
  }

  async listSelectionProducts(selectionId: string): Promise<string[]> {
    return [...(this.memberships.get(selectionId) ?? [])];
  }

  async getObject(container: string, key: string) {
    const o = this.objects.get(`${container}/${key}`);
    return o ? { value: clone(o.value), version: o.version } : undefined;
  }

  async putObject(container: string, key: string, value: unknown): Promise<void> {
    const prev = this.objects.get(`${container}/${key}`);
    this.objects.set(`${container}/${key}`, { container, key, value: clone(value), version: (prev?.version ?? 0) + 1 });
    this.writes += 1;
  }

  async verifyCustomerEmail(res: { id: string; version: number }): Promise<void> {
    const c = this.all('customers').find((x) => x.id === res.id);
    if (!c) throw new ApiError(404, `customer ${res.id} not found`);
    c.isEmailVerified = true;
    c.version += 1;
    this.writes += 1;
  }

  async removeObject(container: string, key: string): Promise<void> {
    if (!this.objects.delete(`${container}/${key}`)) throw new ApiError(404, `custom object ${container}/${key} not found`);
    this.writes += 1;
  }

  async listObjects(container: string) {
    return [...this.objects.values()].filter((o) => o.container === container).map((o) => ({ key: o.key, value: clone(o.value) }));
  }

  async getProject(): Promise<ProjectView> {
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
