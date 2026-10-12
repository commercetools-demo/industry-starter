// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';

/**
 * A thin, uniform layer over the SDK. Every seed step talks to `Api`, so unit tests can swap in the in-memory
 * `FakeApi` (src/fake-api.ts) and prove idempotency and cleanup safety without credentials.
 */
export type Kind =
  | 'product-types' | 'categories' | 'products' | 'tax-categories' | 'zones' | 'shipping-methods' | 'channels'
  | 'customer-groups' | 'types' | 'stores' | 'product-selections' | 'associate-roles' | 'business-units' | 'customers'
  | 'inventory' | 'product-discounts' | 'cart-discounts' | 'discount-codes' | 'recurrence-policies'
  | 'product-tailoring' | 'standalone-prices' | 'states' | 'carts' | 'orders';

export interface Res {
  id: string;
  version: number;
  key?: string;
  [field: string]: unknown;
}

export interface Api {
  getByKey(kind: Kind, key: string): Promise<Res | undefined>;
  getById(kind: Kind, id: string): Promise<Res | undefined>;
  list(kind: Kind, opts?: { where?: string }): Promise<Res[]>;
  /** `store` is only used for product-tailoring (created in a store). */
  create(kind: Kind, body: Record<string, unknown>, opts?: { store?: string }): Promise<Res>;
  update(kind: Kind, res: { id: string; version: number }, actions: Record<string, unknown>[]): Promise<Res>;
  remove(kind: Kind, res: { id: string; version: number }): Promise<void>;
  /** Product ids that are in a product selection. */
  listSelectionProducts(selectionId: string): Promise<string[]>;
  getObject(container: string, key: string): Promise<{ value: unknown; version: number } | undefined>;
  putObject(container: string, key: string, value: unknown): Promise<void>;
  removeObject(container: string, key: string): Promise<void>;
  listObjects(container: string): Promise<{ key: string; value: unknown }[]>;
  getProject(): Promise<ProjectView>;
  updateProject(version: number, actions: Record<string, unknown>[]): Promise<ProjectView>;
}

export interface ProjectView {
  key: string;
  version: number;
  languages: string[];
  countries: string[];
  currencies: string[];
  searchIndexing?: { products?: { status?: string }; productsSearch?: { status?: string } };
  carts?: { countryTaxRateFallbackEnabled?: boolean };
}

/** Resolves `undefined` when the API answers 404, rethrows anything else. */
export async function orUndefined<T>(get: () => Promise<{ body: T }>): Promise<T | undefined> {
  try {
    return (await get()).body;
  } catch (e) {
    const status = (e as { statusCode?: number; code?: number }).statusCode ?? (e as { code?: number }).code;
    if (status === 404) return undefined;
    throw e;
  }
}

// Loosely typed view of the SDK request builders; they all share this shape.
type Call<T = unknown> = { execute(): Promise<{ body: T }> };
interface Item {
  get(a?: { queryArgs?: Record<string, unknown> }): Call<Res>;
  post(a: { body: unknown }): Call<Res>;
  delete(a?: { queryArgs?: Record<string, unknown> }): Call;
}
interface Endpoint {
  get(a?: { queryArgs?: Record<string, unknown> }): Call<{ results: Res[]; total?: number }>;
  post(a: { body: unknown }): Call<unknown>;
  withKey(a: { key: string }): Item;
  withId(a: { ID: string }): Item;
}

function endpoint(root: ByProjectKeyRequestBuilder, kind: Kind, store?: string): Endpoint {
  const e = (x: unknown) => x as Endpoint;
  switch (kind) {
    case 'product-types': return e(root.productTypes());
    case 'categories': return e(root.categories());
    case 'products': return e(root.products());
    case 'tax-categories': return e(root.taxCategories());
    case 'zones': return e(root.zones());
    case 'shipping-methods': return e(root.shippingMethods());
    case 'channels': return e(root.channels());
    case 'customer-groups': return e(root.customerGroups());
    case 'types': return e(root.types());
    case 'stores': return e(root.stores());
    case 'product-selections': return e(root.productSelections());
    case 'associate-roles': return e(root.associateRoles());
    case 'business-units': return e(root.businessUnits());
    case 'customers': return e(root.customers());
    case 'inventory': return e(root.inventory());
    case 'product-discounts': return e(root.productDiscounts());
    case 'cart-discounts': return e(root.cartDiscounts());
    case 'discount-codes': return e(root.discountCodes());
    case 'recurrence-policies': return e(root.recurrencePolicies());
    case 'carts': return e(root.carts());
    case 'orders': return e(root.orders());
    case 'standalone-prices': return e(root.standalonePrices());
    case 'states': return e(root.states());
    case 'product-tailoring':
      return store ? e(root.inStoreKeyWithStoreKeyValue({ storeKey: store }).productTailoring()) : e(root.productTailoring());
  }
}

const PAGE = 200;

export function sdkApi(root: ByProjectKeyRequestBuilder): Api {
  return {
    getByKey: (kind, key) => orUndefined(() => endpoint(root, kind).withKey({ key }).get().execute()),
    getById: (kind, id) => orUndefined(() => endpoint(root, kind).withId({ ID: id }).get().execute()),
    async list(kind, opts) {
      const out: Res[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const queryArgs: Record<string, unknown> = { limit: PAGE, offset, sort: 'id asc', ...(opts?.where ? { where: opts.where } : {}) };
        const { results } = (await endpoint(root, kind).get({ queryArgs }).execute()).body;
        out.push(...results);
        if (results.length < PAGE) return out;
      }
    },
    async create(kind, body, opts) {
      const res = (await endpoint(root, kind, opts?.store).post({ body }).execute()).body as Record<string, unknown>;
      // Customer creation answers { customer, cart? }.
      return (res.customer ?? res) as Res;
    },
    async update(kind, res, actions) {
      return (await endpoint(root, kind).withId({ ID: res.id }).post({ body: { version: res.version, actions } }).execute()).body;
    },
    async remove(kind, res) {
      await endpoint(root, kind).withId({ ID: res.id }).delete({ queryArgs: { version: res.version } }).execute();
    },
    async listSelectionProducts(selectionId) {
      const out: string[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { results } = (await root.productSelections().withId({ ID: selectionId }).products().get({ queryArgs: { limit: PAGE, offset } }).execute()).body;
        out.push(...results.map((r) => r.product.id));
        if (results.length < PAGE) return out;
      }
    },
    async getObject(container, key) {
      const o = await orUndefined(() => root.customObjects().withContainerAndKey({ container, key }).get().execute());
      return o ? { value: o.value, version: o.version } : undefined;
    },
    async putObject(container, key, value) {
      await root.customObjects().post({ body: { container, key, value: value as never } }).execute();
    },
    async removeObject(container, key) {
      await root.customObjects().withContainerAndKey({ container, key }).delete().execute();
    },
    async listObjects(container) {
      const out: { key: string; value: unknown }[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { results } = (await root.customObjects().withContainer({ container }).get({ queryArgs: { limit: PAGE, offset } }).execute()).body;
        out.push(...results.map((r) => ({ key: r.key, value: r.value })));
        if (results.length < PAGE) return out;
      }
    },
    async getProject() {
      return (await root.get().execute()).body as unknown as ProjectView;
    },
    async updateProject(version, actions) {
      return (await root.post({ body: { version, actions: actions as never } }).execute()).body as unknown as ProjectView;
    },
  };
}
