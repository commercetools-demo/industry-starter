// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';

/**
 * A thin, uniform layer over the SDK. Every seed step talks to `Api`, so unit tests can swap in the in-memory
 * `FakeApi` (src/fake-api.ts) and prove idempotency and cleanup safety without credentials.
 */
export type Kind =
  | 'product-types' | 'categories' | 'products' | 'tax-categories' | 'zones' | 'shipping-methods' | 'channels'
  | 'types' | 'customers' | 'inventory' | 'product-discounts' | 'cart-discounts' | 'discount-codes'
  | 'recurrence-policies' | 'states' | 'shopping-lists' | 'reviews';

export const ALL_KINDS: Kind[] = [
  'product-types', 'categories', 'products', 'tax-categories', 'zones', 'shipping-methods', 'channels', 'types', 'customers',
  'inventory', 'product-discounts', 'cart-discounts', 'discount-codes', 'recurrence-policies', 'states', 'shopping-lists', 'reviews',
];

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
  create(kind: Kind, body: Record<string, unknown>): Promise<Res>;
  update(kind: Kind, res: { id: string; version: number }, actions: Record<string, unknown>[]): Promise<Res>;
  remove(kind: Kind, res: { id: string; version: number }): Promise<void>;
  /** Marks a customer's email as verified (email token, then confirm); there is no update action for it. */
  verifyCustomerEmail(res: { id: string; version: number }): Promise<void>;
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

function endpoint(root: ByProjectKeyRequestBuilder, kind: Kind): Endpoint {
  const e = (x: unknown) => x as Endpoint;
  switch (kind) {
    case 'product-types': return e(root.productTypes());
    case 'categories': return e(root.categories());
    case 'products': return e(root.products());
    case 'tax-categories': return e(root.taxCategories());
    case 'zones': return e(root.zones());
    case 'shipping-methods': return e(root.shippingMethods());
    case 'channels': return e(root.channels());
    case 'types': return e(root.types());
    case 'customers': return e(root.customers());
    case 'inventory': return e(root.inventory());
    case 'product-discounts': return e(root.productDiscounts());
    case 'cart-discounts': return e(root.cartDiscounts());
    case 'discount-codes': return e(root.discountCodes());
    case 'recurrence-policies': return e(root.recurrencePolicies());
    case 'states': return e(root.states());
    case 'shopping-lists': return e(root.shoppingLists());
    case 'reviews': return e(root.reviews());
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
    async create(kind, body) {
      const res = (await endpoint(root, kind).post({ body }).execute()).body as Record<string, unknown>;
      // Customer creation answers { customer, cart? }.
      return (res.customer ?? res) as Res;
    },
    async update(kind, res, actions) {
      return (await endpoint(root, kind).withId({ ID: res.id }).post({ body: { version: res.version, actions } }).execute()).body;
    },
    async remove(kind, res) {
      await endpoint(root, kind).withId({ ID: res.id }).delete({ queryArgs: { version: res.version } }).execute();
    },
    async verifyCustomerEmail(res) {
      const { value } = (await root.customers().emailToken().post({ body: { id: res.id, version: res.version, ttlMinutes: 10 } }).execute()).body;
      await root.customers().emailConfirm().post({ body: { tokenValue: value } }).execute();
    },
    async getProject() {
      return (await root.get().execute()).body as unknown as ProjectView;
    },
    async updateProject(version, actions) {
      return (await root.post({ body: { version, actions: actions as never } }).execute()).body as unknown as ProjectView;
    },
  };
}
