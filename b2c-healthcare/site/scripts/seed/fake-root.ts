import { createFakeObjects, type FakeObjects } from '../../test/fake-custom-objects';
import { evalPredicate } from '../../test/fake-predicate';
import type { Rec, Root } from './lib';

/**
 * In-memory stand-in for the commercetools project root, used by the seed unit tests (never the network).
 * It models only what the seed relies on, including a few refusals the real API makes, so ordering mistakes fail:
 * a published product, a category with children, a product type still used, a zone still used by a shipping method
 * and a tax category still used cannot be deleted.
 */
export interface FakeLog { op: 'create' | 'update' | 'delete'; kind: string; key?: string; id: string; actions?: string[]; /** The `dataErasure` query argument of a DELETE. */ dataErasure?: boolean }

export interface FakeRoot {
  root: Root;
  store: Record<string, Rec[]>;
  log: FakeLog[];
  projectKey: string;
  searchTotal: number | null;
  searchCalls: number;
  /** Custom Objects (containers such as malva-schedule). */
  objects: FakeObjects;
}

const err = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const ref = (r: unknown) => (r as { key?: string; id?: string } | undefined)?.key ?? (r as { id?: string } | undefined)?.id;

export function createFakeRoot(initial: Record<string, Rec[]> = {}, projectKey = 'spec-test-b2c-healthcare'): FakeRoot {
  const fake = { store: {} as Record<string, Rec[]>, log: [] as FakeLog[], projectKey, searchTotal: null as number | null, searchCalls: 0, objects: createFakeObjects() } as FakeRoot;
  let counter = 0;
  const kinds = ['carts', 'orders', 'inventory', 'products', 'categories', 'productTypes', 'shippingMethods', 'taxCategories', 'stores', 'zones', 'states', 'types', 'channels', 'customers', 'reviews', 'recurrencePolicies',
    // workstream X (privacy scripts): the other GDPR resource kinds
    'payments', 'shoppingLists', 'discountCodes', 'businessUnits', 'quotes', 'quoteRequests', 'stagedQuotes', 'messages', 'recurringOrders', 'cartDiscounts'];
  for (const k of kinds) fake.store[k] = [];
  for (const [k, list] of Object.entries(initial)) fake.store[k] = list.map((r) => materialize(k, { ...r }));

  function materialize(kind: string, draft: Rec): Rec {
    // clone: a stored resource must never alias the data constants the seed builds drafts from
    const r: Rec = { id: `id-${(counter += 1)}`, version: 1, ...structuredClone(draft) };
    if (kind === 'products') {
      if (!r.masterData) {
        const d = draft as { masterVariant?: Rec; variants?: Rec[]; publish?: boolean; name?: Rec };
        delete r.masterVariant;
        delete r.variants;
        delete r.publish;
        const master = { id: 1, ...(d.masterVariant ?? {}) } as Rec;
        // the platform gives every price an id (update actions address prices by it)
        master.prices = ((master.prices as Rec[] | undefined) ?? []).map((p) => ({ id: `price-${(counter += 1)}`, ...p }));
        const dd = draft as Rec;
        r.masterData = { published: !!d.publish, staged: { name: d.name, slug: dd.slug, description: dd.description, masterVariant: master, variants: d.variants ?? [] } };
      }
    }
    if (kind === 'categories' && !draft.ancestors) {
      const parent = draft.parent ? fake.store.categories.find((c) => c.key === ref(draft.parent) || c.id === ref(draft.parent)) : undefined;
      r.ancestors = parent ? [...((parent.ancestors as Rec[]) ?? []), { typeId: 'category', id: parent.id }] : [];
    }
    return r;
  }

  const find = (kind: string, sel: { key?: string; id?: string }) => fake.store[kind].find((r) => (sel.key !== undefined ? r.key === sel.key : r.id === sel.id));

  function usedBy(kind: string, r: Rec): string | null {
    const key = r.key as string | undefined;
    const matches = (v: unknown) => ref(v) === key || ref(v) === r.id;
    if (kind === 'categories' && fake.store.categories.some((c) => ((c.ancestors as { id: string }[]) ?? []).at(-1)?.id === r.id)) return 'category has children';
    if (kind === 'productTypes' && fake.store.products.some((p) => matches((p as Rec).productType))) return 'product type in use';
    if (kind === 'zones' && fake.store.shippingMethods.some((m) => ((m.zoneRates as { zone: unknown }[]) ?? []).some((z) => matches(z.zone)))) return 'zone in use';
    if (kind === 'taxCategories' && fake.store.shippingMethods.some((m) => matches((m as Rec).taxCategory))) return 'tax category in use';
    if (kind === 'taxCategories' && fake.store.products.some((p) => matches((p as Rec).taxCategory))) return 'tax category in use';
    if (kind === 'products' && (r.masterData as { published?: boolean }).published) return 'product is published';
    if (kind === 'channels' && fake.store.products.some((p) => JSON.stringify(p).includes(`"key":"${key}"`))) return 'channel in use';
    return null;
  }

  /** The platform rolls review ratings up into the product's `reviewRatingStatistics` (the real one lags by seconds; the fake is immediate). */
  function rollUpRating(review: Rec): void {
    const target = review.target as { key?: string; id?: string } | undefined;
    const product = fake.store.products.find((p) => p.key === target?.key || p.id === target?.id);
    if (!product || typeof review.rating !== 'number') return;
    const stats = (product.reviewRatingStatistics as { count: number; averageRating: number } | undefined) ?? { count: 0, averageRating: 0 };
    const count = stats.count + 1;
    product.reviewRatingStatistics = { count, averageRating: (stats.averageRating * stats.count + review.rating) / count };
  }

  const zoneId = (z: unknown) => (z as { id?: string }).id ?? fake.store.zones.find((x) => x.key === (z as { key?: string }).key)?.id;

  function applyAction(kind: string, r: Rec, a: Rec): void {
    const md = r.masterData as { published: boolean; staged: { masterVariant: Rec; variants: Rec[] } } | undefined;
    switch (a.action) {
      case 'unpublish': if (md) md.published = false; break;
      case 'publish': if (md) md.published = true; break;
      case 'setTransitions': r.transitions = a.transitions; break;
      case 'transitionState': r.state = { typeId: 'state', id: fake.store.states.find((s) => s.key === (a.state as { key?: string }).key)?.id }; break;
      case 'changeShipmentState': r.shipmentState = a.shipmentState; break;
      case 'setRecurringOrderState': r.recurringOrderState = a.recurringOrderState; break;
      case 'removeAssociate': r.associates = ((r.associates as { customer?: { id?: string } }[]) ?? []).filter((x) => x.customer?.id !== (a.customer as { id?: string }).id); break;
      case 'setInventoryLimits': r.maxCartQuantity = a.maxCartQuantity; r.minCartQuantity = a.minCartQuantity; break;
      case 'removeImage':
        if (md) for (const v of [md.staged.masterVariant, ...md.staged.variants]) if (v.id === a.variantId) v.images = ((v.images as { url: string }[]) ?? []).filter((i) => i.url !== a.imageUrl);
        break;
      case 'addExternalImage':
        if (md) for (const v of [md.staged.masterVariant, ...md.staged.variants]) if (v.id === a.variantId) v.images = [...((v.images as Rec[]) ?? []), a.image as Rec];
        break;
      // ---- update actions the seed's update plans send (additive; each mirrors the platform's effect on stored data)
      case 'changeName': if (md) (md.staged as Rec).name = a.name; else r.name = a.name; break;
      case 'changeSlug': if (md) (md.staged as Rec).slug = a.slug; else r.slug = a.slug; break;
      case 'setDescription': if (md) (md.staged as Rec).description = a.description; break;
      case 'addPrice': if (md) md.staged.masterVariant.prices = [...((md.staged.masterVariant.prices as Rec[]) ?? []), { id: `price-${(counter += 1)}`, ...(a.price as Rec) }]; break;
      case 'changePrice': if (md) md.staged.masterVariant.prices = ((md.staged.masterVariant.prices as Rec[]) ?? []).map((p) => (p.id === a.priceId ? { id: p.id, ...(a.price as Rec) } : p)); break;
      case 'removePrice': if (md) md.staged.masterVariant.prices = ((md.staged.masterVariant.prices as Rec[]) ?? []).filter((p) => p.id !== a.priceId); break;
      case 'setAttribute':
        if (md) {
          const attrs = ((md.staged.masterVariant.attributes as { name: string; value: unknown }[]) ?? []).filter((x) => x.name !== a.name);
          md.staged.masterVariant.attributes = [...attrs, { name: a.name as string, value: a.value }];
        }
        break;
      case 'addAttributeDefinition': r.attributes = [...((r.attributes as Rec[]) ?? []), a.attribute]; break;
      case 'changeIsSearchable': r.attributes = ((r.attributes as Rec[]) ?? []).map((x) => (x.name === a.attributeName ? { ...x, isSearchable: a.isSearchable } : x)); break;
      case 'changeAttributeConstraint': r.attributes = ((r.attributes as Rec[]) ?? []).map((x) => (x.name === a.attributeName ? { ...x, attributeConstraint: a.newValue } : x)); break;
      case 'addPlainEnumValue':
        r.attributes = ((r.attributes as Rec[]) ?? []).map((x) => {
          if (x.name !== a.attributeName) return x;
          const t = x.type as { name: string; values?: Rec[]; elementType?: { values?: Rec[] } };
          if (t.name === 'set' && t.elementType) return { ...x, type: { ...t, elementType: { ...t.elementType, values: [...(t.elementType.values ?? []), a.value as Rec] } } };
          return { ...x, type: { ...t, values: [...(t.values ?? []), a.value as Rec] } };
        });
        break;
      case 'addFieldDefinition': r.fieldDefinitions = [...((r.fieldDefinitions as Rec[]) ?? []), a.fieldDefinition]; break;
      case 'changeLabel':
        if (a.attributeName) r.attributes = ((r.attributes as Rec[]) ?? []).map((x) => (x.name === a.attributeName ? { ...x, label: a.label } : x));
        if (a.fieldName) r.fieldDefinitions = ((r.fieldDefinitions as Rec[]) ?? []).map((x) => (x.name === a.fieldName ? { ...x, label: a.label } : x));
        break;
      case 'setCustomType': r.custom = { type: a.type, fields: a.fields }; break;
      case 'setCustomField': r.custom = { ...(r.custom as Rec), fields: { ...((r.custom as { fields?: Rec } | undefined)?.fields ?? {}), [a.name as string]: a.value } }; break;
      case 'setRoles': r.roles = a.roles; break;
      case 'changeIsDefault': r.isDefault = a.isDefault; break;
      case 'addZone': r.zoneRates = [...((r.zoneRates as Rec[]) ?? []), { zone: a.zone, shippingRates: [] }]; break;
      case 'addShippingRate':
        r.zoneRates = ((r.zoneRates as { zone: { id?: string; key?: string }; shippingRates: Rec[] }[]) ?? []).map((z) => (zoneId(z.zone) === zoneId(a.zone) ? { ...z, shippingRates: [...z.shippingRates, a.shippingRate as Rec] } : z));
        break;
      case 'removeShippingRate':
        r.zoneRates = ((r.zoneRates as { zone: { id?: string; key?: string }; shippingRates: { price: { centAmount: number }; freeAbove?: { centAmount: number } }[] }[]) ?? []).map((z) =>
          zoneId(z.zone) === zoneId(a.zone) ? { ...z, shippingRates: z.shippingRates.filter((s) => JSON.stringify([s.price, s.freeAbove ?? null]) !== JSON.stringify([(a.shippingRate as Rec).price, (a.shippingRate as Rec).freeAbove ?? null])) } : z,
        );
        break;
      case 'addTaxRate': r.rates = [...((r.rates as Rec[]) ?? []), { id: `rate-${(counter += 1)}`, ...(a.taxRate as Rec) }]; break;
      case 'replaceTaxRate': r.rates = ((r.rates as Rec[]) ?? []).map((x) => (x.id === a.taxRateId ? { id: x.id, ...(a.taxRate as Rec) } : x)); break;
      case 'removeTaxRate': r.rates = ((r.rates as Rec[]) ?? []).filter((x) => x.id !== a.taxRateId); break;
      case 'addLocation': r.locations = [...((r.locations as Rec[]) ?? []), a.location]; break;
      case 'removeLocation': r.locations = ((r.locations as Rec[]) ?? []).filter((l) => JSON.stringify(l) !== JSON.stringify(a.location)); break;
      case 'changeType': r.type = a.type; break;
      case 'changeInitial': r.initial = a.initial; break;
      default: break;
    }
    void kind;
  }

  function matchWhere(r: Rec, where?: string): boolean {
    // unsupported predicates match everything, as before; supported ones (equality, in, nesting, and, is defined) are evaluated
    return evalPredicate(r, where, true);
  }

  const collection = (kind: string) => ({
    get: (a: { queryArgs?: { limit?: number; offset?: number; where?: string } } = {}) => ({
      execute: async () => {
        const { limit = 20, offset = 0, where } = a.queryArgs ?? {};
        const all = fake.store[kind].filter((r) => matchWhere(r, where));
        return { body: { results: all.slice(offset, offset + limit), total: all.length, count: Math.min(limit, all.length) } };
      },
    }),
    post: (a: { body: Rec }) => ({
      execute: async () => {
        const dup = a.body.key !== undefined && find(kind, { key: a.body.key as string });
        if (dup) throw err(400, `duplicate key ${String(a.body.key)}`);
        const r = materialize(kind, a.body);
        fake.store[kind].push(r);
        if (kind === 'reviews') rollUpRating(r);
        fake.log.push({ op: 'create', kind, key: r.key as string | undefined, id: r.id as string });
        return { body: r };
      },
    }),
    withKey: (sel: { key: string }) => one(kind, sel),
    withId: (sel: { ID: string }) => one(kind, { id: sel.ID }),
  });

  function one(kind: string, sel: { key?: string; id?: string }) {
    const need = () => {
      const r = find(kind, sel);
      if (!r) throw err(404, 'not found');
      return r;
    };
    return {
      get: () => ({ execute: async () => ({ body: need() }) }),
      post: (a: { body: { version: number; actions: Rec[] } }) => ({
        execute: async () => {
          const r = need();
          if (a.body.version !== r.version) throw err(409, 'version conflict');
          for (const action of a.body.actions) applyAction(kind, r, action);
          r.version = (r.version as number) + 1;
          fake.log.push({ op: 'update', kind, key: r.key as string | undefined, id: r.id as string, actions: a.body.actions.map((x) => String(x.action)) });
          return { body: r };
        },
      }),
      delete: (a: { queryArgs: { version: number; dataErasure?: boolean } }) => ({
        execute: async () => {
          const r = need();
          if (a.queryArgs.version !== r.version) throw err(409, 'version conflict');
          const reason = usedBy(kind, r);
          if (reason) throw err(400, `${kind} ${String(r.key)}: ${reason}`);
          fake.store[kind] = fake.store[kind].filter((x) => x !== r);
          fake.log.push({ op: 'delete', kind, key: r.key as string | undefined, id: r.id as string, dataErasure: a.queryArgs.dataErasure });
          return { body: r };
        },
      }),
    };
  }

  const root: Record<string, unknown> = {
    get: () => ({ execute: async () => ({ body: { key: fake.projectKey, messages: { enabled: false }, searchIndexing: { productsSearch: { status: 'Activated' } } } }) }),
  };
  for (const k of kinds) root[k] = () => collection(k);
  root.customObjects = fake.objects.customObjects;
  // Product Search: no real query language; a fullText value matches against product names, otherwise everything.
  root.products = () => ({
    ...collection('products'),
    search: () => ({
      post: (a: { body: { query?: { fullText?: { value: string }; prefix?: { value: string } } } }) => ({
        execute: async () => {
          fake.searchCalls += 1;
          const term = a.body.query?.fullText?.value?.toLowerCase();
          const prefix = a.body.query?.prefix?.value;
          const hits = fake.store.products.filter(
            (p) => (!term || JSON.stringify((p.masterData as Rec).staged).toLowerCase().includes(term)) && (!prefix || String(p.key).startsWith(prefix)),
          );
          return { body: { total: fake.searchTotal ?? hits.length, results: hits.slice(0, 1).map((p) => ({ id: p.id })) } };
        },
      }),
    }),
  });
  fake.root = root as unknown as Root;
  return fake;
}
