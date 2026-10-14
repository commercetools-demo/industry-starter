/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// An in-memory extension of T's fixture client for workstream W: products (create, publish, lookup by sku, key and product type,
// unpublished products hidden from `staged: false` reads as in commercetools), custom object lists, cart discounts by key,
// in-store orders and customers, and an in-memory Import API. It shares its state with `createFakeCommercetools`, so T's
// assortment code and W's code see the same products and selections. Used by W's unit tests and by the development fixture
// mode (`PORTAL_DEV_FIXTURES=on`, never in production). No secrets, no personal data (synthetic `@example.com`).
import 'server-only';
import defaultTemplates from '@/lib/email/default-templates.json';
import demo from '@/lib/marketing/demo-data.json';
import type { ImportOperationState, ImportResourceType, ImportTransport } from '@/lib/import/import-api';
import { createFakeCommercetools, getFixtureCommercetools, type FakeCommercetools, type FakeSeed } from './catalog-fixture-root';

type Obj = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const DAY = 86_400_000;

function httpError(statusCode: number, code: string, message = code): Error {
  return Object.assign(new Error(message), { statusCode, code: statusCode, body: { statusCode, message, errors: [{ code, message }] } });
}

const PRODUCT_TYPE_IDS: Record<string, string> = { 'mau-pt-part': 'pt-part', 'mau-pt-local-part': 'pt-local-part', 'mau-pt-bundle': 'pt-bundle' };

export interface WFake extends FakeCommercetools {
  x: { orders: Obj[]; customers: Obj[]; importOps: Map<string, { type: ImportResourceType; ops: { key: string; polls: number }[] }> };
  importTransport: ImportTransport;
  /** The product that has the key, or undefined. */
  productByKey: (key: string) => Obj | undefined;
}

const extended = new WeakMap<FakeCommercetools, WFake>();

export function extendFake(base: FakeCommercetools, options: { demo?: boolean; seed?: FakeSeed } = {}): WFake {
  const hit = extended.get(base);
  if (hit) return hit;
  const { state } = base;
  let seq = 1000;
  const nextId = (p: string) => `${p}-w${(seq += 1)}`;
  const x: WFake['x'] = { orders: [], customers: [], importOps: new Map() };
  const log = (op: string, args?: unknown) => base.calls.push({ op, args: args === undefined ? undefined : clone(args) });
  const request = <T>(op: string, run: () => T | Promise<T>, args?: unknown) => ({
    execute: async () => {
      log(op, args);
      return { body: clone(await run()) as T, statusCode: 200 };
    },
  });
  const list = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const page = (all: Obj[], a: any) => {
    const offset = Number(a?.queryArgs?.offset ?? 0);
    const limit = Number(a?.queryArgs?.limit ?? 20);
    return { results: all.slice(offset, offset + limit), total: all.length, offset, limit, count: Math.min(limit, Math.max(0, all.length - offset)) };
  };

  // ---- products ----
  const categoryId = (ref: Obj): string => {
    const found = state.categories.find((c: Obj) => (ref.id ? c.id === ref.id : c.key === ref.key));
    if (!found) throw httpError(400, 'InvalidOperation', `unknown category ${ref.key ?? ref.id}`);
    return found.id;
  };
  const byKey = (key: string) => [...state.products.values()].find((p: Obj) => p.key === key);
  const byId = (id: string) => state.products.get(id);
  const productApi = (find: () => Obj) => ({
    get: () => request('product.get', () => find()),
    post: ({ body }: { body: Obj }) =>
      request(
        'product.update',
        () => {
          const p = find();
          if (body.version !== p.version) throw httpError(409, 'ConcurrentModification');
          for (const a of body.actions as Obj[]) {
            if (a.action === 'publish') p.published = true;
            else if (a.action === 'unpublish') p.published = false;
            else throw httpError(400, 'InvalidOperation', `unsupported action ${a.action}`);
          }
          p.version += 1;
          return p;
        },
        body,
      ),
  });
  const createProduct = (body: Obj): Obj => {
    if (byKey(body.key)) throw httpError(400, 'DuplicateField', 'key is not unique');
    const sku = body.masterVariant?.sku as string | undefined;
    if (sku && [...state.products.values()].some((p: Obj) => p.masterVariant.sku === sku)) throw httpError(400, 'DuplicateField', 'sku is not unique');
    for (const [locale, slug] of Object.entries(body.slug ?? {})) {
      if ([...state.products.values()].some((p: Obj) => p.slug?.[locale] === slug)) throw httpError(400, 'DuplicateField', 'slug is not unique');
    }
    const typeKey = body.productType?.key as string;
    const id = nextId('prod');
    const product: Obj = {
      id,
      key: body.key,
      version: 1,
      published: body.publish === true,
      productType: { typeId: 'product-type', id: PRODUCT_TYPE_IDS[typeKey] ?? typeKey },
      name: body.name,
      slug: body.slug,
      description: body.description,
      priceMode: body.priceMode,
      categories: (body.categories ?? []).map((c: Obj) => ({ typeId: 'category', id: categoryId(c) })),
      masterVariant: { id: 1, sku, images: [], attributes: clone(body.masterVariant?.attributes ?? []) },
      variants: [],
    };
    state.products.set(id, product);
    return product;
  };

  const projections = base.root.productProjections();
  const productProjections = () => ({
    ...projections,
    get: (a: any) => ({
      execute: async () => {
        const args = a?.queryArgs ?? {};
        const result = await projections.get(a).execute();
        let results: Obj[] = result.body.results as Obj[];
        const keys = list(args['var.keys']) as string[];
        const typeIds = list(args['var.t']) as string[];
        if (keys.length || typeIds.length || (!list(args['var.ids']).length && !list(args['var.skus']).length)) {
          results = [...state.products.values()].filter((p: Obj) => (keys.length ? keys.includes(p.key) : true) && (typeIds.length ? typeIds.includes(p.productType.id) : true));
        }
        if (args.staged !== true) results = results.filter((p) => p.published !== false);
        return { ...result, body: { ...result.body, results, total: results.length, count: results.length } } as typeof result;
      },
    }),
  });

  // ---- custom objects ----
  const objects = base.root.customObjects();
  const customObjects = () => ({
    ...objects,
    withContainer: ({ container }: { container: string }) => ({
      get: (a: any) => request('object.list', () => page([...state.objects.values()].filter((o: Obj) => o.container === container), a)),
    }),
  });

  // ---- cart discounts by key ----
  const cartDiscounts = () => {
    const api = base.root.cartDiscounts();
    return {
      ...api,
      withKey: ({ key }: { key: string }) => ({
        get: () =>
          request('cartDiscount.getByKey', () => {
            const d = [...state.cartDiscounts.values()].find((c: Obj) => c.key === key);
            if (!d) throw httpError(404, 'ResourceNotFound');
            return d;
          }),
      }),
    };
  };

  // ---- in-store orders and customers ----
  const inStore = ({ storeKey }: { storeKey: string }) => ({
    ...base.root.inStoreKeyWithStoreKeyValue({ storeKey }),
    orders: () => ({ get: (a: any) => request('order.list', () => page(x.orders.filter((o) => o.store?.key === storeKey).sort((p, q) => (p.createdAt < q.createdAt ? 1 : -1)), a)) }),
    customers: () => ({ get: (a: any) => request('customer.list', () => page(x.customers.filter((c) => c.stores?.some((s: Obj) => s.key === storeKey)), a)) }),
  });

  // ---- Import API ----
  const importTransport: ImportTransport = {
    async createContainer(key, type) {
      x.importOps.set(key, { type, ops: [] });
    },
    async importResources(container, type, resources) {
      const c = x.importOps.get(container);
      if (!c) throw httpError(404, 'ResourceNotFound');
      for (const r of resources as Obj[]) {
        c.ops.push({ key: r.key, polls: 0 });
        if (type === 'product-draft') {
          try {
            createProduct(r);
          } catch (error) {
            (c.ops[c.ops.length - 1] as Obj).error = (error as Error).message;
          }
        } else {
          const channel = [...state.channels.values()].find((ch: Obj) => ch.key === r.channel?.key);
          if (!channel || state.prices.has(r.key)) (c.ops[c.ops.length - 1] as Obj).error = !channel ? 'unknown channel' : 'key is not unique';
          else state.prices.set(r.key, { id: nextId('price'), key: r.key, version: 1, sku: r.sku, active: true, value: clone(r.value), country: r.country, channel: { typeId: 'channel', id: channel.id } });
        }
      }
    },
    async operations(container): Promise<ImportOperationState[]> {
      const c = x.importOps.get(container);
      if (!c) throw httpError(404, 'ResourceNotFound');
      return c.ops.map((op: Obj) => {
        op.polls += 1;
        if (op.polls < 2) return { resourceKey: op.key, state: 'processing', errors: [] };
        return op.error ? { resourceKey: op.key, state: 'validationFailed', errors: [op.error] } : { resourceKey: op.key, state: 'imported', errors: [] };
      });
    },
  };

  const root = {
    ...base.root,
    productProjections,
    productTypes: () => ({
      withKey: ({ key }: { key: string }) =>
        ({
          get: () =>
            request('productType.get', () => {
              if (!PRODUCT_TYPE_IDS[key]) throw httpError(404, 'ResourceNotFound');
              return { id: PRODUCT_TYPE_IDS[key], key, version: 1 };
            }),
        }),
    }),
    customObjects,
    cartDiscounts,
    inStoreKeyWithStoreKeyValue: inStore,
    products: () => ({
      post: ({ body }: { body: Obj }) => request('product.create', () => createProduct(body), body),
      withKey: ({ key }: { key: string }) =>
        productApi(() => {
          const p = byKey(key);
          if (!p) throw httpError(404, 'ResourceNotFound');
          return p;
        }),
      withId: ({ ID }: { ID: string }) =>
        productApi(() => {
          const p = byId(ID);
          if (!p) throw httpError(404, 'ResourceNotFound');
          return p;
        }),
    }),
  };

  const wfake: WFake = { ...base, root: root as unknown as FakeCommercetools['root'], x, importTransport, productByKey: byKey };
  extended.set(base, wfake);
  if (options.demo) seedDemo(wfake, options.seed);
  return wfake;
}

/** Demo data of the development mode: brake sub-categories, two co-op campaigns, six customers per store with orders. */
function seedDemo(fake: WFake, seed?: FakeSeed): void {
  const { state, x } = fake;
  const brakes = state.categories.find((c: Obj) => c.id === 'cat-brakes');
  if (brakes && !state.categories.some((c: Obj) => c.id === 'cat-brake-pads')) {
    state.categories.push({ id: 'cat-brake-pads', key: 'mau-cat-brake-pads', name: { 'de-DE': 'Bremsbeläge', 'en-US': 'Brake pads' }, parent: { typeId: 'category', id: 'cat-brakes' } });
    state.categories.push({ id: 'cat-brake-discs', key: 'mau-cat-brake-discs', name: { 'de-DE': 'Bremsscheiben', 'en-US': 'Brake discs' }, parent: { typeId: 'category', id: 'cat-brakes' } });
    for (const p of state.products.values() as Iterable<Obj>) {
      const sku = p.masterVariant.sku as string;
      if (sku.startsWith('MLV-BP-')) p.categories.push({ typeId: 'category', id: 'cat-brake-pads' });
      if (sku.startsWith('MLV-BD-')) p.categories.push({ typeId: 'category', id: 'cat-brake-discs' });
    }
  }
  const vehicles = [
    ['Volkswagen', 'Golf', 'VII', 2012, 2019, '1.4 TSI'],
    ['Volkswagen', 'Golf', 'VII', 2012, 2019, '2.0 TDI'],
    ['Audi', 'A3', '8V', 2012, 2020, '1.4 TFSI'],
    ['BMW', '3 Series', 'F30', 2012, 2019, '320d'],
  ] as const;
  for (const [make, model, generation, yearFrom, yearTo, engine] of vehicles) {
    const fitmentKey = `${make}|${model}|${yearFrom}|${yearTo}|${engine}`;
    const key = `mau-veh-${fitmentKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    state.objects.set(`mau-vehicles/${key}`, { id: `obj-${key}`, container: 'mau-vehicles', key, version: 1, value: { make, model, generation, yearFrom, yearTo, engine, markets: ['DE'], fitmentKey } });
  }
  for (const c of demo.campaigns) {
    state.objects.set(`malva-coop-campaigns/${c.key}`, { id: `obj-${c.key}`, container: 'malva-coop-campaigns', key: c.key, version: 1, value: clone(c) });
  }
  const stores = (seed?.stores ?? [...state.stores.values()].map((s: Obj) => ({ key: s.key }))).map((s) => s.key as string);
  const pid = (sku: string) => fake.ids.sku(sku);
  const now = Date.now();
  const people: { n: number; consent: boolean | null; orders: { sku: string; daysAgo: number }[] }[] = [
    { n: 1, consent: true, orders: [{ sku: 'MLV-BP-41001', daysAgo: 20 }, { sku: 'MLV-BD-42001', daysAgo: 20 }] },
    { n: 2, consent: true, orders: [{ sku: 'MLV-BD-42001', daysAgo: 100 }] },
    { n: 3, consent: true, orders: [{ sku: 'MLV-OF-44001', daysAgo: 30 }] },
    { n: 4, consent: true, orders: [] },
    { n: 5, consent: false, orders: [{ sku: 'MLV-BD-42001', daysAgo: 10 }] },
    { n: 6, consent: null, orders: [{ sku: 'MLV-BP-41001', daysAgo: 200 }] },
  ];
  for (const store of stores) {
    state.objects.set(`malva-email-templates/${store}--order-confirmation`, {
      id: `obj-tpl-${store}`,
      container: 'malva-email-templates',
      key: `${store}--order-confirmation`,
      version: 1,
      value: { ...clone(defaultTemplates['order-confirmation']), storeKey: store, demo: true, updatedAt: new Date(now).toISOString() },
    });
    for (const p of people) {
      const id = `fx-cust-${store}-${p.n}`;
      x.customers.push({
        id,
        email: `shopper${p.n}.${store}@example.com`,
        stores: [{ typeId: 'store', key: store }],
        ...(p.consent === null ? {} : { custom: { type: { typeId: 'type', key: 'malva-customer' }, fields: { marketingConsent: p.consent } } }),
      });
      for (const [i, o] of p.orders.entries()) {
        x.orders.push({ id: `fx-order-${store}-${p.n}-${i}`, customerId: id, store: { typeId: 'store', key: store }, createdAt: new Date(now - o.daysAgo * DAY).toISOString(), lineItems: [{ productId: pid(o.sku), variant: { sku: o.sku } }] });
      }
    }
  }
}

let devWFake: WFake | undefined;
/** The singleton of the development fixture mode: T's fixture client extended once, with demo data. */
export function getWFixture(): WFake {
  devWFake ??= extendFake(getFixtureCommercetools(), { demo: true });
  return devWFake;
}

export const wFixtureRoot = new Proxy({} as WFake['root'], {
  get: (_t, prop) => (getWFixture().root as unknown as Record<string | symbol, unknown>)[prop],
});

/** A fresh fake for a unit test (T's seed, plus W's calls). */
export function createWFake(options: { demo?: boolean; seed?: FakeSeed } = {}): WFake {
  return extendFake(createFakeCommercetools(options.seed), options);
}
