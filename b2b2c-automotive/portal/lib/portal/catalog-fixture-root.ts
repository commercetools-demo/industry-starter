/* eslint-disable @typescript-eslint/no-explicit-any */
// An in-memory stand-in for the seller-admin commercetools client, for workstream T only: just the calls that
// lib/ct/seller/{assortment,assortment-write,prices,tailoring,discounts} make, with versions (409 on a stale version),
// unique sortOrder per discount kind and unique keys. Used in two places:
//   - unit tests (`createFakeCommercetools`), so request shapes and version handling are tested without credentials;
//   - the development fixture mode (`PORTAL_DEV_FIXTURES=on`, never in production): `fixtureRoot`, so the catalog screens
//     can be run and checked in a browser without a commercetools project (OA-01).
// It holds no secrets and no personal data. The data mirrors the seed shape (seed/src/data/*): keys, price key scheme, selections.
import 'server-only';

type Obj = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export interface FakeStoreDef {
  key: string;
  name: Record<string, string>;
  countries: string[];
  languages: string[];
  retailKey: string;
  branchKeys: string[];
  selectionKey: string;
  /** SKUs in the store's own selection (parts of the master pool and own items). */
  assigned: string[];
  withdrawn?: { sku: string; reason: string }[];
  pendingReview?: string[];
}

export interface FakeProduct {
  sku: string;
  nameDe: string;
  nameEn: string;
  descriptionEn?: string;
  category: string;
  /** EUR cents of the Malva list price; null: pre-release, no price. */
  eur: number | null;
  /** Reseller-owned item: only a channel price on the owner's retail channel. */
  ownerStore?: string;
  reviewState?: 'approved' | 'pending';
  inMaster: boolean;
  images?: string[];
}

export interface FakeSeed {
  stores: FakeStoreDef[];
  products: FakeProduct[];
  /** Extra standalone prices: [sku, channelKey, currency, cents]. */
  channelPrices: [string, string, 'EUR' | 'USD', number][];
  blockedUpstream: { sku: string; by: string; reason: string }[];
  categories: { id: string; key: string; name: Record<string, string>; parent?: string }[];
  tailorings: { store: string; sku: string; name?: Record<string, string>; description?: Record<string, string>; images?: string[] }[];
  carts: { id: string; store: string; skus: string[]; state?: string }[];
  discounts: { product: Obj[]; cart: Obj[]; codes: Obj[] };
}

const CATS = [
  { id: 'cat-brakes', key: 'mau-cat-brakes', name: { 'de-DE': 'Bremsen', 'en-US': 'Brakes' } },
  { id: 'cat-filters', key: 'mau-cat-filters', name: { 'de-DE': 'Filter', 'en-US': 'Filters' } },
  { id: 'cat-exhaust', key: 'mau-cat-exhaust', name: { 'de-DE': 'Abgasanlage', 'en-US': 'Exhaust' } },
  { id: 'cat-electrical', key: 'mau-cat-electrical', name: { 'de-DE': 'Elektrik', 'en-US': 'Electrical' } },
];

const P = (sku: string, nameDe: string, nameEn: string, category: string, eur: number | null, extra: Partial<FakeProduct> = {}): FakeProduct => ({
  sku, nameDe, nameEn, category, eur, inMaster: true, ...extra,
});

export const CATALOG: FakeProduct[] = [
  P('MLV-BP-41001', 'Bremsbeläge vorn, Keramik', 'Front brake pads, ceramic', 'cat-brakes', 9450, { descriptionEn: 'Quiet ceramic pads.', images: ['https://images.example.test/master/MLV-BP-41001.jpg'] }),
  P('MLV-BP-41003', 'Bremsbeläge vorn, Economy', 'Front brake pads, economy', 'cat-brakes', 5900),
  P('MLV-BD-42001', 'Bremsscheibe vorn, belüftet', 'Brake disc, front vented', 'cat-brakes', 6800),
  P('MLV-OF-44001', 'Ölfilter, Anschraubfilter', 'Oil filter, spin-on', 'cat-filters', 1290),
  P('MLV-OF-44002', 'Ölfilter Diesel', 'Oil filter diesel', 'cat-filters', 1890),
  P('MLV-AF-45001', 'Luftfilter', 'Air filter', 'cat-filters', 2150),
  P('MLV-EX-52001', 'Endschalldämpfer', 'Rear muffler', 'cat-exhaust', 18900),
  P('MLV-BT-54001', 'Starterbatterie 70 Ah', 'Starter battery 70 Ah', 'cat-electrical', 12900),
  P('MLV-HL-56002', 'LED-Nebelscheinwerfer', 'LED fog lamp', 'cat-electrical', 8900),
  P('MLV-BP-41099', 'Bremsbeläge vorn, Neuheit', 'Front brake pads, new', 'cat-brakes', null),
  P('KW-1001', 'Werkstattset Nord', 'Workshop set north', 'cat-brakes', 4500, { inMaster: false, ownerStore: 'north', reviewState: 'approved' }),
  P('SK-2002', 'Sonderteil Süd', 'Special part south', 'cat-electrical', 3200, { inMaster: false, ownerStore: 'south', reviewState: 'pending' }),
];

const channelKeys = (short: string) => ({ retail: `mau-dist-${short}`, branches: [`mau-br-${short}-one`, `mau-br-${short}-two`] });

export function seedForStores(storeKeys: [string, string] = ['mau-reseller-north', 'mau-reseller-south']): FakeSeed {
  const [north, south] = storeKeys;
  const n = channelKeys('north');
  const s = channelKeys('south');
  const products = clone(CATALOG).map((p) => (p.ownerStore === 'north' ? { ...p, ownerStore: north } : p.ownerStore === 'south' ? { ...p, ownerStore: south } : p));
  const northAssigned = ['MLV-BP-41001', 'MLV-BD-42001', 'MLV-OF-44001', 'MLV-OF-44002', 'MLV-AF-45001', 'MLV-BT-54001', 'KW-1001'];
  const southAssigned = ['MLV-BP-41001', 'MLV-BP-41003', 'MLV-BD-42001', 'MLV-OF-44001', 'MLV-OF-44002', 'MLV-EX-52001', 'MLV-BT-54001'];
  return {
    stores: [
      { key: north, name: { 'de-DE': 'Küstenwerk Autoteile', 'en-US': 'Küstenwerk Auto Parts' }, countries: ['DE'], languages: ['de-DE', 'en-US'], retailKey: n.retail, branchKeys: n.branches, selectionKey: 'mau-sel-north', assigned: northAssigned, withdrawn: [{ sku: 'MLV-BP-41003', reason: 'Quality policy: premium brake parts only' }] },
      { key: south, name: { 'de-DE': 'Südkamm Autoteile', 'en-US': 'Südkamm Auto Parts' }, countries: ['DE', 'US'], languages: ['de-DE', 'en-US'], retailKey: s.retail, branchKeys: s.branches, selectionKey: 'mau-sel-south', assigned: southAssigned, pendingReview: ['SK-2002'] },
    ],
    products,
    channelPrices: [
      ['MLV-BP-41001', n.retail, 'EUR', 9000],
      ['MLV-BD-42001', n.retail, 'EUR', 7200],
      ['KW-1001', n.retail, 'EUR', 4500],
      ['MLV-BP-41001', s.retail, 'EUR', 9300],
      ['MLV-BP-41001', s.retail, 'USD', 10200],
      ['MLV-BP-41001', s.branches[0], 'EUR', 9200],
    ],
    blockedUpstream: [{ sku: 'MLV-HL-56002', by: 'Malva DACH', reason: 'No type approval for road use in Germany' }],
    categories: CATS,
    tailorings: [
      { store: north, sku: 'MLV-BP-41001', name: { 'de-DE': 'Küstenwerk Bremsbeläge vorn, Keramik', 'en-US': 'Front brake pads, ceramic' }, description: { 'de-DE': 'Leise und staubarm.', 'en-US': 'Quiet ceramic pads.' }, images: ['https://images.example.test/tailored/north-41001.jpg'] },
      { store: south, sku: 'MLV-OF-44001', description: { 'de-DE': 'Ölfilter-Wechsel in 10 Minuten.', 'en-US': 'Oil filter change in 10 minutes.' } },
    ],
    carts: [
      { id: 'cart-1', store: north, skus: ['MLV-BP-41001'] },
      { id: 'cart-2', store: north, skus: ['MLV-BP-41001', 'MLV-OF-44001'] },
      { id: 'cart-3', store: south, skus: ['MLV-BP-41001'] },
      { id: 'cart-4', store: north, skus: ['MLV-BP-41001'], state: 'Ordered' },
    ],
    discounts: {
      product: [
        { key: 'mau-pd-malva-filter-autumn', name: { 'de-DE': 'Malva Herbstaktion Filter', 'en-US': 'Malva autumn filter promotion' }, value: { type: 'relative', permyriad: 1000 }, predicate: 'categoriesWithAncestors.key contains "mau-cat-filters"', sortOrder: '0.91', isActive: true },
        { key: 'mau-pd-north-brake-week', name: { 'de-DE': 'Bremsenwoche', 'en-US': 'Brake week' }, value: { type: 'relative', permyriad: 800 }, predicate: `categoriesWithAncestors.key contains "mau-cat-brakes" and channel.id = "ch-${n.retail}"`, sortOrder: '0.51', isActive: true },
        { key: 'mau-pd-south-battery-bonus', name: { 'de-DE': 'Batteriebonus', 'en-US': 'Battery bonus' }, value: { type: 'absolute', money: [{ currencyCode: 'EUR', centAmount: 500 }, { currencyCode: 'USD', centAmount: 500 }] }, predicate: `categories.key contains "mau-cat-electrical" and channel.id = "ch-${s.retail}"`, sortOrder: '0.52', isActive: true },
      ],
      cart: [
        { key: 'mau-cd-malva-welcome', name: { 'de-DE': 'Malva Willkommensrabatt', 'en-US': 'Malva welcome discount' }, value: { type: 'relative', permyriad: 500 }, cartPredicate: 'true', target: { type: 'totalPrice' }, sortOrder: '0.91', requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking', custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'malva' } } },
        { key: 'mau-cd-north-large-order', name: { 'de-DE': 'Großauftrag -3 %', 'en-US': 'Large order -3%' }, value: { type: 'relative', permyriad: 300 }, cartPredicate: 'lineItemTotal(true) >= "2000.00 EUR"', target: { type: 'totalPrice' }, sortOrder: '0.51', requiresDiscountCode: false, isActive: true, stackingMode: 'Stacking', stores: [{ typeId: 'store', key: north }], custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'reseller', storeKey: north } } },
        { key: 'mau-cd-south-brake-code', name: { 'de-DE': 'Bremsen-Code', 'en-US': 'Brake code' }, value: { type: 'relative', permyriad: 500 }, cartPredicate: 'lineItemExists(categoriesWithAncestors.key contains "mau-cat-brakes")', target: { type: 'lineItems', predicate: 'categoriesWithAncestors.key contains "mau-cat-brakes"' }, sortOrder: '0.52', requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking', stores: [{ typeId: 'store', key: south }], custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'reseller', storeKey: south } } },
      ],
      codes: [{ key: 'mau-dc-brake5', code: 'SUEDKAMM-BRAKE5', cartDiscountKey: 'mau-cd-south-brake-code', isActive: true }],
    },
  };
}

/** Fixture stores of the portal development mode (lib/portal/dev-fixtures.ts) share the same catalog. */
export function devSeed(): FakeSeed {
  const base = seedForStores(['fx-store-online', 'fx-store-south']);
  const online = base.stores[0];
  const direct: FakeStoreDef = { ...online, key: 'fx-store-direct', name: { 'de-DE': 'Workshop Direct', 'en-US': 'Workshop Direct' }, retailKey: 'mau-dist-direct', branchKeys: ['mau-br-direct-one'], selectionKey: 'mau-sel-direct', withdrawn: [] };
  return { ...base, stores: [...base.stores, { ...direct, assigned: online.assigned.filter((sku) => sku !== 'KW-1001') }] };
}

export interface FakeCall {
  op: string;
  args?: unknown;
}

function httpError(statusCode: number, code: string, message = code): Error {
  return Object.assign(new Error(message), { statusCode, code: statusCode, body: { statusCode, message, errors: [{ code, message }] } });
}

const WRITE_OPS = /\.(create|update|delete|write)$/;

export function createFakeCommercetools(seed: FakeSeed = seedForStores()) {
  const calls: FakeCall[] = [];
  const conflictOnce = new Set<string>();
  const state = {
    channels: new Map<string, Obj>(),
    stores: new Map<string, Obj>(),
    selections: new Map<string, Obj>(),
    products: new Map<string, Obj>(),
    prices: new Map<string, Obj>(),
    objects: new Map<string, Obj>(),
    tailorings: new Map<string, Obj>(),
    productDiscounts: new Map<string, Obj>(),
    cartDiscounts: new Map<string, Obj>(),
    codes: new Map<string, Obj>(),
    carts: [] as Obj[],
    categories: clone(seed.categories) as Obj[],
  };
  let seq = 0;
  const nextId = (p: string) => `${p}-${(seq += 1)}`;

  const skuToId = new Map<string, string>();
  const idToSku = new Map<string, string>();
  for (const p of seed.products) {
    const id = `prod-${p.sku}`;
    skuToId.set(p.sku, id);
    idToSku.set(id, p.sku);
    state.products.set(id, {
      id,
      key: p.ownerStore ? `mau-local-${p.sku.toLowerCase()}` : `mau-part-${p.sku.toLowerCase()}`,
      productType: { typeId: 'product-type', id: p.ownerStore ? 'pt-local-part' : 'pt-part' },
      name: { 'de-DE': p.nameDe, 'en-US': p.nameEn },
      description: p.descriptionEn ? { 'en-US': p.descriptionEn, 'de-DE': p.descriptionEn } : undefined,
      categories: [{ typeId: 'category', id: p.category }],
      masterVariant: {
        id: 1,
        sku: p.sku,
        images: (p.images ?? []).map((url) => ({ url, dimensions: { w: 800, h: 800 } })),
        attributes: p.ownerStore ? [{ name: 'owner-store', value: p.ownerStore }, { name: 'review-state', value: p.reviewState ?? 'approved' }] : [],
      },
      variants: [],
    });
  }

  const addChannel = (key: string, roles: string[]) => {
    const ch = { id: `ch-${key}`, key, roles };
    state.channels.set(key, ch);
    return ch;
  };

  state.selections.set('mau-sel-malva-master', {
    id: 'sel-master',
    key: 'mau-sel-malva-master',
    version: 1,
    mode: 'Individual',
    products: new Set(seed.products.filter((p) => p.inMaster).map((p) => skuToId.get(p.sku) as string)),
  });

  for (const def of seed.stores) {
    const retail = addChannel(def.retailKey, ['ProductDistribution']);
    const branches = def.branchKeys.map((k) => addChannel(k, ['InventorySupply', 'ProductDistribution']));
    const sel = { id: `sel-${def.selectionKey}`, key: def.selectionKey, version: 1, mode: 'Individual', products: new Set(def.assigned.map((sku) => skuToId.get(sku) as string)) };
    state.selections.set(def.selectionKey, sel);
    state.stores.set(def.key, {
      id: `store-${def.key}`,
      key: def.key,
      version: 1,
      name: def.name,
      countries: def.countries.map((code) => ({ code })),
      languages: def.languages,
      distributionChannels: [retail, ...branches].sort((a, b) => (a.key < b.key ? -1 : 1)).map((c) => ({ typeId: 'channel', id: c.id, obj: c })),
      supplyChannels: [],
      productSelections: [{ productSelection: { typeId: 'product-selection', id: sel.id, obj: { id: sel.id, key: sel.key } }, active: true }],
    });
    state.objects.set(`mau-assortment/${def.key}`, {
      id: nextId('obj'),
      container: 'mau-assortment',
      key: def.key,
      version: 1,
      value: {
        storeKey: def.key,
        withdrawnByReseller: def.withdrawn ?? [],
        blockedUpstream: seed.blockedUpstream,
        preRelease: seed.products.filter((p) => p.eur === null).map((p) => p.sku),
        pendingReview: def.pendingReview ?? [],
      },
    });
  }

  const addPrice = (key: string, sku: string, currency: string, cents: number, channelKey?: string) => {
    const channel = channelKey ? state.channels.get(channelKey) ?? addChannel(channelKey, ['ProductDistribution']) : undefined;
    state.prices.set(key, {
      id: nextId('price'), key, version: 1, sku, active: true,
      value: { type: 'centPrecision', currencyCode: currency, centAmount: cents, fractionDigits: 2 },
      country: currency === 'EUR' ? 'DE' : 'US',
      ...(channel ? { channel: { typeId: 'channel', id: channel.id } } : {}),
    });
  };
  for (const p of seed.products) {
    if (p.eur !== null && !p.ownerStore) {
      addPrice(`${p.sku}__base-eur-de`, p.sku, 'EUR', p.eur);
      addPrice(`${p.sku}__base-usd-us`, p.sku, 'USD', Math.round((p.eur * 1.08) / 10) * 10);
    }
  }
  for (const [sku, channelKey, currency, cents] of seed.channelPrices) addPrice(`${sku}__${channelKey}${currency === 'USD' ? '__usd' : ''}`, sku, currency, cents, channelKey);

  for (const t of seed.tailorings) {
    const productId = skuToId.get(t.sku) as string;
    const data = { name: t.name, description: t.description, variants: t.images ? [{ id: 1, sku: t.sku, images: t.images.map((url) => ({ url, dimensions: { w: 800, h: 600 } })) }] : [] };
    state.tailorings.set(`${t.store}/${productId}`, { id: nextId('tl'), version: 1, key: `mau-tl-${t.store}-${t.sku.toLowerCase()}`, store: { typeId: 'store', key: t.store }, product: { typeId: 'product', id: productId }, published: true, hasStagedChanges: false, current: clone(data), staged: clone(data) });
  }
  for (const c of seed.carts) state.carts.push({ id: c.id, cartState: c.state ?? 'Active', store: { typeId: 'store', key: c.store }, lineItems: c.skus.map((sku) => ({ productId: skuToId.get(sku) })) });

  const addDiscount = (map: Map<string, Obj>, d: Obj, prefix: string) => {
    const id = nextId(prefix);
    map.set(id, { id, version: 1, ...clone(d) });
    return id;
  };
  for (const d of seed.discounts.product) addDiscount(state.productDiscounts, d, 'pd');
  const cartIds = new Map<string, string>();
  for (const d of seed.discounts.cart) cartIds.set(d.key, addDiscount(state.cartDiscounts, d, 'cd'));
  for (const c of seed.discounts.codes) {
    const id = nextId('dc');
    state.codes.set(id, { id, version: 1, key: c.key, code: c.code, isActive: c.isActive, cartDiscounts: [{ typeId: 'cart-discount', id: cartIds.get(c.cartDiscountKey) }] });
  }

  // ---- helpers ----
  const log = (op: string, args?: unknown) => calls.push({ op, args: args === undefined ? undefined : clone(args) });
  const request = <T>(op: string, run: () => T | Promise<T>, args?: unknown) => ({
    execute: async () => {
      log(op, args);
      return { body: clone(await run()) as T, statusCode: 200 };
    },
  });
  const maybeConflict = (op: string, resource: Obj) => {
    if (conflictOnce.delete(op)) resource.version += 1; // somebody else wrote in between
  };
  const checkVersion = (resource: Obj, version: unknown) => {
    if (version !== resource.version) throw httpError(409, 'ConcurrentModification');
  };
  const bump = (resource: Obj) => {
    resource.version += 1;
    return resource;
  };
  const arg = (a: any, name: string) => a?.queryArgs?.[name];
  const list = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  const storeView = (key: string) => {
    const s = state.stores.get(key);
    if (!s) throw httpError(404, 'ResourceNotFound');
    return s;
  };

  const projection = (id: string) => state.products.get(id);

  // product selections
  const selectionByKey = (key: string) => {
    const s = state.selections.get(key);
    if (!s) throw httpError(404, 'ResourceNotFound');
    return s;
  };
  const selectionById = (id: string) => {
    const s = [...state.selections.values()].find((x) => x.id === id);
    if (!s) throw httpError(404, 'ResourceNotFound');
    return s;
  };
  const selectionBody = (s: Obj) => ({ id: s.id, key: s.key, version: s.version, mode: s.mode });

  // price helpers
  const priceById = (key: string) => {
    const p = state.prices.get(key);
    if (!p) throw httpError(404, 'ResourceNotFound');
    return p;
  };

  // discounts
  const discountApi = (kind: 'product' | 'cart') => {
    const map = kind === 'product' ? state.productDiscounts : state.cartDiscounts;
    const opPrefix = kind === 'product' ? 'productDiscount' : 'cartDiscount';
    const assertUnique = (sortOrder: string, exceptId?: string) => {
      for (const d of map.values()) if (d.sortOrder === sortOrder && d.id !== exceptId) throw httpError(400, 'DuplicateField', 'sortOrder is not unique');
    };
    const byId = (id: string) => {
      const d = map.get(id);
      if (!d) throw httpError(404, 'ResourceNotFound');
      return d;
    };
    const apply = (d: Obj, actions: Obj[]) => {
      for (const a of actions) {
        switch (a.action) {
          case 'changeIsActive': d.isActive = a.isActive; break;
          case 'changeSortOrder': assertUnique(a.sortOrder, d.id); d.sortOrder = a.sortOrder; break;
          case 'changeName': d.name = a.name; break;
          case 'changeValue': d.value = a.value; break;
          case 'changePredicate': d.predicate = a.predicate; break;
          case 'changeCartPredicate': d.cartPredicate = a.cartPredicate; break;
          case 'changeTarget': d.target = a.target; break;
          case 'changeStackingMode': d.stackingMode = a.stackingMode; break;
          case 'changeRequiresDiscountCode': d.requiresDiscountCode = a.requiresDiscountCode; break;
          case 'setKey': d.key = a.key; break;
          case 'setValidFrom': d.validFrom = a.validFrom; break;
          case 'setValidUntil': d.validUntil = a.validUntil; break;
          case 'setValidFromAndUntil': d.validFrom = a.validFrom; d.validUntil = a.validUntil; break;
          case 'setDescription': d.description = a.description; break;
          default: throw httpError(400, 'InvalidOperation', `unsupported action ${a.action}`);
        }
      }
    };
    return {
      get: (a: any) => request(`${opPrefix}.list`, () => {
        const all = [...map.values()].sort((x, y) => (x.sortOrder < y.sortOrder ? 1 : -1));
        const offset = Number(arg(a, 'offset') ?? 0);
        const limit = Number(arg(a, 'limit') ?? 20);
        return { results: all.slice(offset, offset + limit), total: all.length, offset, limit, count: Math.min(limit, Math.max(0, all.length - offset)) };
      }),
      post: ({ body }: { body: Obj }) => request(`${opPrefix}.create`, () => {
        assertUnique(body.sortOrder);
        if ([...map.values()].some((d) => d.key && d.key === body.key)) throw httpError(400, 'DuplicateField', 'key is not unique');
        const id = addDiscount(map, body, kind === 'product' ? 'pd' : 'cd');
        return map.get(id) as Obj;
      }, body),
      withId: ({ ID }: { ID: string }) => ({
        get: () => request(`${opPrefix}.get`, () => byId(ID)),
        post: ({ body }: { body: Obj }) => request(`${opPrefix}.update`, () => {
          const d = byId(ID);
          maybeConflict(`${opPrefix}.update`, d);
          checkVersion(d, body.version);
          apply(d, body.actions);
          return bump(d);
        }, body),
        delete: ({ queryArgs }: { queryArgs: { version: number } }) => request(`${opPrefix}.delete`, () => {
          const d = byId(ID);
          checkVersion(d, queryArgs.version);
          map.delete(ID);
          return d;
        }),
      }),
    };
  };

  const tailoringApi = (storeKey: string) => {
    const keyOf = (pid: string) => `${storeKey}/${pid}`;
    const find = (pid: string) => {
      const t = state.tailorings.get(keyOf(pid));
      if (!t) throw httpError(404, 'ResourceNotFound');
      return t;
    };
    const publish = (t: Obj) => {
      t.current = clone(t.staged);
      t.published = true;
      t.hasStagedChanges = false;
    };
    const listAll = () => {
      const all = [...state.tailorings.values()].filter((t) => t.store.key === storeKey);
      return { results: all, total: all.length, offset: 0, limit: 500, count: all.length };
    };
    return {
      productTailoring: () => ({
        get: () => request('tailoring.list', listAll),
        post: ({ body }: { body: Obj }) => request('tailoring.create', () => {
          storeView(storeKey);
          const pid = body.product.id as string;
          if (state.tailorings.has(keyOf(pid))) throw httpError(400, 'DuplicateField', 'tailoring exists');
          const data = { name: body.name, description: body.description, variants: (body.variants ?? []).map((v: Obj, i: number) => ({ id: i + 1, sku: v.sku, images: v.images })) };
          const t: Obj = { id: nextId('tl'), version: 1, store: { typeId: 'store', key: storeKey }, product: { typeId: 'product', id: pid }, published: false, hasStagedChanges: true, current: { variants: [] }, staged: clone(data) };
          if (body.publish) publish(t);
          state.tailorings.set(keyOf(pid), t);
          return t;
        }, body),
      }),
      products: () => ({
        withProductId: ({ productID }: { productID: string }) => ({
          productTailoring: () => ({
            get: () => request('tailoring.get', () => find(productID)),
            post: ({ body }: { body: Obj }) => request('tailoring.update', () => {
              const t = find(productID);
              maybeConflict('tailoring.update', t);
              checkVersion(t, body.version);
              for (const a of body.actions as Obj[]) {
                if (a.action === 'setName') t.staged.name = a.name;
                else if (a.action === 'setDescription') t.staged.description = a.description;
                else if (a.action === 'setImages') {
                  t.staged.variants = (t.staged.variants ?? []).filter((v: Obj) => v.sku !== a.sku);
                  if (a.images) t.staged.variants.push({ id: 1, sku: a.sku, images: a.images });
                } else if (a.action === 'publish') publish(t);
                else throw httpError(400, 'InvalidOperation', `unsupported action ${a.action}`);
                if (a.action !== 'publish') t.hasStagedChanges = true;
              }
              return bump(t);
            }, body),
            delete: ({ queryArgs }: { queryArgs: { version: number } }) => request('tailoring.delete', () => {
              const t = find(productID);
              checkVersion(t, queryArgs.version);
              state.tailorings.delete(keyOf(productID));
              return t;
            }, queryArgs),
          }),
        }),
      }),
    };
  };

  const root = {
    stores: () => ({ withKey: ({ key }: { key: string }) => ({ get: () => request('store.get', () => storeView(key)) }) }),
    categories: () => ({ get: () => request('category.list', () => ({ results: state.categories, total: state.categories.length, offset: 0, limit: 500, count: state.categories.length })) }),
    productSelections: () => ({
      withKey: ({ key }: { key: string }) => ({
        get: () => request('selection.get', () => selectionBody(selectionByKey(key))),
        products: () => ({
          get: (a: any) => request('selection.products', () => {
            const s = selectionByKey(key);
            const ids = [...s.products] as string[];
            const offset = Number(arg(a, 'offset') ?? 0);
            const limit = Number(arg(a, 'limit') ?? 20);
            return { results: ids.slice(offset, offset + limit).map((id) => ({ product: { typeId: 'product', id } })), total: ids.length, offset, limit, count: Math.min(limit, Math.max(0, ids.length - offset)) };
          }),
        }),
      }),
      withId: ({ ID }: { ID: string }) => ({
        post: ({ body }: { body: Obj }) => request('selection.update', () => {
          const s = selectionById(ID);
          maybeConflict('selection.update', s);
          checkVersion(s, body.version);
          if ((body.actions as Obj[]).length > 100) throw httpError(400, 'InvalidOperation', 'at most 100 actions');
          for (const a of body.actions as Obj[]) {
            if (a.action === 'addProduct') s.products.add(a.product.id);
            else if (a.action === 'removeProduct') s.products.delete(a.product.id);
            else throw httpError(400, 'InvalidOperation', `unsupported action ${a.action}`);
          }
          return selectionBody(bump(s));
        }, body),
      }),
    }),
    productProjections: () => ({
      get: (a: any) => request('projection.list', () => {
        const ids = list(arg(a, 'var.ids')) as string[];
        const skus = list(arg(a, 'var.skus')) as string[];
        const all = [...state.products.values()];
        const results = ids.length ? all.filter((p) => ids.includes(p.id)) : skus.length ? all.filter((p) => skus.includes(p.masterVariant.sku)) : all;
        return { results, total: results.length, offset: 0, limit: 500, count: results.length };
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => request('projection.get', () => {
          const p = projection(ID);
          if (!p) throw httpError(404, 'ResourceNotFound');
          return p;
        }),
      }),
    }),
    customObjects: () => ({
      withContainerAndKey: ({ container, key }: { container: string; key: string }) => ({
        get: () => request('object.get', () => {
          const o = state.objects.get(`${container}/${key}`);
          if (!o) throw httpError(404, 'ResourceNotFound');
          return o;
        }),
      }),
      post: ({ body }: { body: Obj }) => request('object.write', () => {
        const k = `${body.container}/${body.key}`;
        const existing = state.objects.get(k);
        if (existing) {
          maybeConflict('object.write', existing);
          if (body.version !== undefined) checkVersion(existing, body.version);
          existing.value = clone(body.value);
          return bump(existing);
        }
        const created = { id: nextId('obj'), container: body.container, key: body.key, version: 1, value: clone(body.value) };
        state.objects.set(k, created);
        return created;
      }, body),
    }),
    standalonePrices: () => ({
      get: (a: any) => request('price.list', () => {
        const skus = list(arg(a, 'var.skus')) as string[];
        const results = [...state.prices.values()].filter((p) => (skus.length ? skus.includes(p.sku) : true));
        return { results, total: results.length, offset: 0, limit: 500, count: results.length };
      }),
      post: ({ body }: { body: Obj }) => request('price.create', () => {
        if (state.prices.has(body.key)) throw httpError(400, 'DuplicateField', 'key is not unique');
        const channel = body.channel ? [...state.channels.values()].find((c) => c.key === body.channel.key) : undefined;
        if (body.channel && !channel) throw httpError(400, 'InvalidOperation', 'unknown channel');
        const created: Obj = { id: nextId('price'), key: body.key, version: 1, sku: body.sku, active: true, value: clone(body.value), ...(body.country ? { country: body.country } : {}), ...(channel ? { channel: { typeId: 'channel', id: channel.id } } : {}) };
        state.prices.set(body.key, created);
        return created;
      }, body),
      withKey: ({ key }: { key: string }) => ({
        get: () => request('price.get', () => priceById(key)),
        post: ({ body }: { body: Obj }) => request('price.update', () => {
          const p = priceById(key);
          maybeConflict('price.update', p);
          checkVersion(p, body.version);
          for (const a of body.actions as Obj[]) {
            if (a.action === 'changeValue') p.value = { ...p.value, currencyCode: a.value.currencyCode, centAmount: a.value.centAmount };
            else throw httpError(400, 'InvalidOperation', `unsupported action ${a.action}`);
          }
          return bump(p);
        }, body),
        delete: ({ queryArgs }: { queryArgs: { version: number } }) => request('price.delete', () => {
          const p = priceById(key);
          maybeConflict('price.delete', p);
          checkVersion(p, queryArgs.version);
          state.prices.delete(key);
          return p;
        }),
      }),
    }),
    carts: () => ({
      get: (a: any) => request('cart.list', () => {
        const store = arg(a, 'var.s');
        const ids = list(arg(a, 'var.ids')) as string[];
        const results = state.carts.filter((c) => c.cartState === 'Active' && (store === undefined || c.store.key === store) && c.lineItems.some((l: Obj) => ids.includes(l.productId)));
        return { results, total: results.length, offset: 0, limit: 500, count: results.length };
      }),
    }),
    inStoreKeyWithStoreKeyValue: ({ storeKey }: { storeKey: string }) => tailoringApi(storeKey),
    productDiscounts: () => discountApi('product'),
    cartDiscounts: () => discountApi('cart'),
    discountCodes: () => ({
      get: (a: any) => request('code.list', () => {
        const code = arg(a, 'var.c');
        const results = [...state.codes.values()].filter((c) => (code === undefined ? true : c.code === code));
        return { results, total: results.length, offset: 0, limit: 500, count: results.length };
      }),
      post: ({ body }: { body: Obj }) => request('code.create', () => {
        if ([...state.codes.values()].some((c) => c.code === body.code)) throw httpError(400, 'DuplicateField', 'code is not unique');
        const id = nextId('dc');
        const created = { id, version: 1, ...clone(body) };
        state.codes.set(id, created);
        return created;
      }, body),
    }),
  };

  return {
    root,
    state,
    calls,
    /** The next call of this operation first meets a concurrent writer (its version moves), so the first attempt is a 409. */
    conflictOnce: (op: string) => void conflictOnce.add(op),
    writes: () => calls.filter((c) => WRITE_OPS.test(c.op)),
    callsOf: (op: string) => calls.filter((c) => c.op === op),
    resetCalls: () => void (calls.length = 0),
    ids: { sku: (sku: string) => skuToId.get(sku) as string, sku_of: (id: string) => idToSku.get(id) },
    selectionSkus: (key: string) => [...(state.selections.get(key)?.products ?? [])].map((id: string) => idToSku.get(id)).sort() as string[],
  };
}

export type FakeCommercetools = ReturnType<typeof createFakeCommercetools>;

let dev: FakeCommercetools | undefined;
/** The singleton the dev fixture mode uses (state lives for the life of the dev server). */
export function getFixtureCommercetools(): FakeCommercetools {
  dev ??= createFakeCommercetools(devSeed());
  return dev;
}
export const fixtureRoot = new Proxy({} as FakeCommercetools['root'], {
  get: (_t, prop) => (getFixtureCommercetools().root as Record<string | symbol, unknown>)[prop],
});
