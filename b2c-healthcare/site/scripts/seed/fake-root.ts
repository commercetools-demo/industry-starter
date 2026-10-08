import { createFakeObjects, type FakeObjects } from '../../test/fake-custom-objects';
import type { Rec, Root } from './lib';

/**
 * In-memory stand-in for the commercetools project root, used by the seed unit tests (never the network).
 * It models only what the seed relies on, including a few refusals the real API makes, so ordering mistakes fail:
 * a published product, a category with children, a product type still used, a zone still used by a shipping method
 * and a tax category still used cannot be deleted.
 */
export interface FakeLog { op: 'create' | 'update' | 'delete'; kind: string; key?: string; id: string; actions?: string[] }

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
  const kinds = ['carts', 'orders', 'inventory', 'products', 'categories', 'productTypes', 'shippingMethods', 'taxCategories', 'stores', 'zones', 'states', 'types', 'channels', 'customers', 'reviews'];
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
        r.masterData = { published: !!d.publish, staged: { name: d.name, masterVariant: { id: 1, ...(d.masterVariant ?? {}) }, variants: d.variants ?? [] } };
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

  function applyAction(kind: string, r: Rec, a: Rec): void {
    const md = r.masterData as { published: boolean; staged: { masterVariant: Rec; variants: Rec[] } } | undefined;
    switch (a.action) {
      case 'unpublish': if (md) md.published = false; break;
      case 'publish': if (md) md.published = true; break;
      case 'setTransitions': r.transitions = a.transitions; break;
      case 'transitionState': r.state = { typeId: 'state', id: fake.store.states.find((s) => s.key === (a.state as { key?: string }).key)?.id }; break;
      case 'changeShipmentState': r.shipmentState = a.shipmentState; break;
      case 'setInventoryLimits': r.maxCartQuantity = a.maxCartQuantity; r.minCartQuantity = a.minCartQuantity; break;
      case 'removeImage':
        if (md) for (const v of [md.staged.masterVariant, ...md.staged.variants]) if (v.id === a.variantId) v.images = ((v.images as { url: string }[]) ?? []).filter((i) => i.url !== a.imageUrl);
        break;
      case 'addExternalImage':
        if (md) for (const v of [md.staged.masterVariant, ...md.staged.variants]) if (v.id === a.variantId) v.images = [...((v.images as Rec[]) ?? []), a.image as Rec];
        break;
      default: break;
    }
    void kind;
  }

  function matchWhere(r: Rec, where?: string): boolean {
    if (!where) return true;
    const m = /^(\w+)="([^"]*)"$/.exec(where);
    return m ? r[m[1]] === m[2] : true;
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
      delete: (a: { queryArgs: { version: number } }) => ({
        execute: async () => {
          const r = need();
          if (a.queryArgs.version !== r.version) throw err(409, 'version conflict');
          const reason = usedBy(kind, r);
          if (reason) throw err(400, `${kind} ${String(r.key)}: ${reason}`);
          fake.store[kind] = fake.store[kind].filter((x) => x !== r);
          fake.log.push({ op: 'delete', kind, key: r.key as string | undefined, id: r.id as string });
          return { body: r };
        },
      }),
    };
  }

  const root: Record<string, unknown> = {
    get: () => ({ execute: async () => ({ body: { key: fake.projectKey, searchIndexing: { productsSearch: { status: 'Activated' } } } }) }),
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
