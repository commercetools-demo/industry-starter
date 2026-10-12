// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import { K, ls } from './data/base';
import { assortmentKeys, assortmentObject, masterKeys } from './data/assortment';
import { allProductDrafts, loadImages, type ImageMap } from './data/catalog';
import { categoryDrafts } from './data/categories';
import { THEME_CONTAINER, THEME_KEY, defaultTheme, TAILORINGS } from './data/content';
import { typeDrafts } from './data/custom-types';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { BUSINESS_UNITS, CUSTOMERS, STORES, channelDrafts, roleDrafts, storeDrafts } from './data/org';
import { standalonePriceDrafts } from './data/prices';
import { stateDrafts } from './data/states';
import { productTypeDrafts } from './data/product-types';
import { shippingMethodDrafts, taxCategoryDraft, zoneDrafts } from './data/tax-shipping';
import { VEHICLES, vehicleObjectKey } from './data/vehicles';
import { businessUnitDraft, customerDraft, tailoringDraft, SELECTION_FOR_STORE } from './drafts';
import { FakeApi } from './fake-api';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';
import { ensureProjectSettings } from './settings';
import * as S from './sync';

/**
 * Creates and updates everything the two Malva sites need, in dependency order. Idempotent: a second run reports 0
 * changes. Reads first, writes only the difference.
 *
 *   npm run seed [-- --dry-run] [-- --only <step[,step]>] [-- --offline]
 *
 * `--dry-run` reads the project and prints what would change, writing nothing.
 * `--dry-run --offline` needs no credentials: it runs the whole seed against an in-memory fake API and prints the plan
 * a fresh project would get.
 */
type Obj = Record<string, unknown>;
export interface SeedOptions {
  api: Api;
  run: Runner;
  demoPassword: string;
  images?: ImageMap;
  categoryImages?: ImageMap;
  bannerImages?: ImageMap;
  /** Recorded tailored images, key `<store>--<sku>` (`tailoring-images.json`); they win over the placeholders in the data. */
  tailoringImages?: ImageMap;
  pause?: () => Promise<void>;
  waitMs?: number;
}

export class Ctx {
  readonly api: Api;
  readonly run: Runner;
  readonly demoPassword: string;
  readonly images: ImageMap;
  readonly categoryImages: ImageMap;
  readonly bannerImages: ImageMap;
  readonly tailoringImages: ImageMap;
  readonly pause: () => Promise<void>;
  private readonly idKeys = new Map<string, Map<string, string>>();

  constructor(o: SeedOptions) {
    this.api = o.api; this.run = o.run; this.demoPassword = o.demoPassword;
    this.images = o.images ?? {}; this.categoryImages = o.categoryImages ?? {}; this.bannerImages = o.bannerImages ?? {};
    this.tailoringImages = o.tailoringImages ?? {};
    this.pause = o.pause ?? (() => Promise.resolve());
  }

  /** id -> key lookup for one reference type, loaded once per run (refresh after creating resources of that kind). */
  async loadKeys(typeId: string, kind: Kind): Promise<void> {
    const m = new Map<string, string>();
    for (const r of await this.api.list(kind)) if (r.key) m.set(r.id, r.key);
    this.idKeys.set(typeId, m);
  }

  keyOf: S.KeyOf = (typeId, id) => this.idKeys.get(typeId)?.get(id);
}

/** Creates a resource when it is missing, otherwise applies `plan(existing)` actions. Returns the resource (undefined in a dry run that creates). */
export async function upsert(ctx: Ctx, kind: Kind, label: string, draft: Obj, plan?: (existing: Res) => S.Action[], opts?: { store?: string }): Promise<Res | undefined> {
  const key = draft.key as string;
  const existing = await ctx.api.getByKey(kind, key);
  if (!existing) {
    const created = await ctx.run.act(`create ${label}`, () => ctx.api.create(kind, draft, opts));
    await ctx.pause();
    return created;
  }
  const actions = plan ? plan(existing) : [];
  if (actions.length === 0) return existing;
  const updated = await ctx.run.act(`update ${label} (${actions.map((a) => String(a.action)).join(', ')})`, () => ctx.api.update(kind, existing, actions));
  await ctx.pause();
  return updated ?? existing;
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Obj).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Custom object write (the API call is an upsert); counted as a change only when the value differs. */
export async function putObject(ctx: Ctx, container: string, key: string, value: unknown, opts?: { onlyIfMissing?: boolean }): Promise<void> {
  const have = await ctx.api.getObject(container, key);
  if (have && (opts?.onlyIfMissing || stable(have.value) === stable(value))) return;
  await ctx.run.act(`${have ? 'update' : 'create'} custom object ${container}/${key}`, () => ctx.api.putObject(container, key, value));
}

interface Step { name: string; run: (ctx: Ctx) => Promise<void> }

const refresh = async (ctx: Ctx) => {
  await ctx.loadKeys('channel', 'channels');
  await ctx.loadKeys('product-selection', 'product-selections');
  await ctx.loadKeys('customer', 'customers');
};

export const STEPS: Step[] = [
  { name: 'settings', run: (c) => ensureProjectSettings(c.api, c.run) },
  {
    name: 'tax-shipping',
    run: async (c) => {
      await upsert(c, 'tax-categories', `tax category ${taxCategoryDraft.key}`, taxCategoryDraft as unknown as Obj);
      for (const z of zoneDrafts) await upsert(c, 'zones', `zone ${z.key}`, z as unknown as Obj);
      for (const s of shippingMethodDrafts) await upsert(c, 'shipping-methods', `shipping method ${s.key}`, s as unknown as Obj);
    },
  },
  {
    name: 'product-types',
    run: async (c) => {
      for (const p of productTypeDrafts) await upsert(c, 'product-types', `product type ${p.key}`, p as unknown as Obj, (e) => S.planProductTypeUpdate(e, p));
    },
  },
  {
    name: 'categories',
    run: async (c) => {
      for (const d of categoryDrafts) {
        const images = c.categoryImages[d.key as string] ?? [];
        const draft = { ...d, ...(images.length ? { assets: images.map((i, n) => ({ key: `image-${n + 1}`, name: ls('Bild', 'Image'), sources: [{ uri: i.url, dimensions: i.dimensions, contentType: 'image/jpeg' }], tags: ['image'] })) } : {}) };
        await upsert(c, 'categories', `category ${d.key}`, draft as unknown as Obj, (e) => [
          ...S.planCategoryUpdate(e, d),
          ...(images.length && !((e.assets as unknown[]) ?? []).length ? [{ action: 'setAssets', assets: (draft as Obj).assets }] : []),
        ]);
      }
    },
  },
  {
    name: 'types',
    run: async (c) => {
      for (const t of typeDrafts) await upsert(c, 'types', `custom type ${t.key}`, t as unknown as Obj, (e) => S.planTypeUpdate(e, t));
    },
  },
  {
    name: 'states',
    run: async (c) => {
      for (const s of stateDrafts) await upsert(c, 'states', `order state ${s.key}`, s as unknown as Obj);
    },
  },
  {
    name: 'channels',
    run: async (c) => {
      for (const ch of channelDrafts) await upsert(c, 'channels', `channel ${ch.key}`, ch as unknown as Obj, (e) => S.planChannelUpdate(e, ch));
    },
  },
  {
    name: 'recurrence',
    run: async (c) => {
      for (const r of recurrencePolicyDrafts) await upsert(c, 'recurrence-policies', `recurrence policy ${r.key}`, r as unknown as Obj);
    },
  },
  {
    name: 'vehicles',
    run: async (c) => {
      for (const v of VEHICLES) await putObject(c, K.cVehicles, vehicleObjectKey(v), v);
    },
  },
  {
    name: 'products',
    run: async (c) => {
      await refresh(c);
      for (const d of allProductDrafts(c.images)) {
        await upsert(c, 'products', `product ${d.key}`, d as unknown as Obj, (e) => S.planProductUpdate(e, d as never));
      }
    },
  },
  {
    // Every price is a standalone price (Q-003): Malva base, reseller retail on the distribution channel, branch prices.
    name: 'prices',
    run: async (c) => {
      for (const d of standalonePriceDrafts()) await upsert(c, 'standalone-prices', `standalone price ${d.key}`, d as unknown as Obj, (e) => S.planStandalonePriceUpdate(e, d));
    },
  },
  {
    name: 'inventory',
    run: async (c) => {
      for (const d of inventoryDrafts()) await upsert(c, 'inventory', `inventory ${d.key}`, d as unknown as Obj, (e) => S.planInventoryUpdate(e, d));
    },
  },
  {
    name: 'stores',
    run: async (c) => {
      await refresh(c);
      for (const d of storeDrafts()) await upsert(c, 'stores', `store ${d.key}`, d as unknown as Obj, (e) => S.planStoreUpdate(e, d as never, c.keyOf));
    },
  },
  {
    name: 'selections',
    run: async (c) => {
      const named: Record<string, { de: string; en: string; keys: string[] }> = {
        [K.selMaster]: { de: 'Malva Gesamtsortiment', en: 'Malva master catalog', keys: masterKeys() },
        [K.selNorth]: { de: 'Küstenwerk Sortiment', en: 'Küstenwerk assortment', keys: assortmentKeys(K.storeNorth) },
        [K.selSouth]: { de: 'Südkamm Sortiment', en: 'Südkamm assortment', keys: assortmentKeys(K.storeSouth) },
      };
      const products = (await c.api.list('products')).filter((p) => p.key?.startsWith('mau-'));
      const idByKey = new Map(products.map((p) => [p.key as string, p.id]));
      for (const [key, def] of Object.entries(named)) {
        let sel = await upsert(c, 'product-selections', `product selection ${key}`, { key, name: ls(def.de, def.en), mode: 'Individual' });
        if (!sel) continue; // dry run: not created yet
        const want = def.keys.map((k) => idByKey.get(k)).filter((x): x is string => !!x);
        const actions = S.planSelectionMembers(await c.api.listSelectionProducts(sel.id), want);
        if (actions.length > 0) {
          const adds = actions.filter((a) => a.action === 'addProduct').length;
          sel = await c.run.act(`update product selection ${key} (+${adds} / -${actions.length - adds} products)`, () => c.api.update('product-selections', sel as Res, actions)) ?? sel;
        }
      }
      await c.loadKeys('product-selection', 'product-selections');
      for (const [storeKey, selKey] of Object.entries(SELECTION_FOR_STORE)) {
        const store = await c.api.getByKey('stores', storeKey);
        if (!store) continue;
        const actions = S.planStoreUpdate(store, { productSelections: [{ productSelection: { key: selKey }, active: true }] } as never, c.keyOf);
        if (actions.length > 0) {
          const full = [{ action: 'setProductSelections', productSelections: [{ productSelection: { typeId: 'product-selection', key: selKey }, active: true }] }];
          await c.run.act(`assign ${selKey} to store ${storeKey}`, () => c.api.update('stores', store, full));
        }
      }
    },
  },
  {
    name: 'roles',
    run: async (c) => {
      for (const r of roleDrafts) await upsert(c, 'associate-roles', `associate role ${r.key}`, r as unknown as Obj, (e) => S.planRoleUpdate(e, r));
    },
  },
  {
    name: 'customers',
    run: async (c) => {
      if (!c.run.dryRun && c.demoPassword.length < 10) throw new Error('SEED_DEMO_PASSWORD must be set and at least 10 characters');
      for (const cu of CUSTOMERS) await upsert(c, 'customers', `customer ${cu.email}`, customerDraft(cu, c.demoPassword || 'dry-run-placeholder'));
    },
  },
  {
    name: 'business-units',
    run: async (c) => {
      await c.loadKeys('customer', 'customers');
      // Parents first: BUSINESS_UNITS is ordered that way.
      for (const b of BUSINESS_UNITS) {
        const d = businessUnitDraft(b);
        await upsert(c, 'business-units', `business unit ${b.key}`, d, (e) => S.planBusinessUnitUpdate(e, d as never, (id) => c.keyOf('customer', id)));
      }
    },
  },
  {
    name: 'discounts',
    run: async (c) => {
      for (const d of productDiscountDrafts) await upsert(c, 'product-discounts', `product discount ${d.key}`, d as unknown as Obj, (e) => S.planDiscountUpdate('product-discounts', e, d));
      for (const d of cartDiscountDrafts) await upsert(c, 'cart-discounts', `cart discount ${d.key}`, d as unknown as Obj, (e) => S.planDiscountUpdate('cart-discounts', e, d));
      for (const d of discountCodeDrafts) await upsert(c, 'discount-codes', `discount code ${d.key}`, d as unknown as Obj);
    },
  },
  {
    name: 'tailoring',
    run: async (c) => {
      for (const t of TAILORINGS) {
        const d = tailoringDraft(t, c.tailoringImages as never);
        await upsert(c, 'product-tailoring', `product tailoring ${d.key}`, d, (e) => S.planTailoringUpdate(e, d as never), { store: t.store });
      }
    },
  },
  {
    name: 'content',
    run: async (c) => {
      for (const s of STORES) await putObject(c, K.cAssortment, s.key, assortmentObject(s.key));
      // The default Contentools theme is only created when missing: resellers and the ThemeManager own it afterwards.
      await putObject(c, THEME_CONTAINER, THEME_KEY, defaultTheme, { onlyIfMissing: true });
      if (Object.keys(c.bannerImages).length > 0) await putObject(c, K.cSite, 'banner-images', c.bannerImages);
    },
  },
];

export const STEP_NAMES = STEPS.map((s) => s.name);

export function selectSteps(only?: string): Step[] {
  if (!only) return STEPS;
  const names = only.split(',').map((x) => x.trim()).filter(Boolean);
  const unknown = names.filter((n) => !STEP_NAMES.includes(n));
  if (unknown.length) throw new Error(`Unknown step ${unknown.join(', ')}. Steps: ${STEP_NAMES.join(' ')}`);
  return STEPS.filter((s) => names.includes(s.name));
}

export async function runSeed(o: SeedOptions, only?: string): Promise<number> {
  const ctx = new Ctx(o);
  for (const step of selectSteps(only)) {
    ctx.run.note(`== ${step.name}`);
    await step.run(ctx);
  }
  return ctx.run.changes;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const offline = argv.includes('--offline');
  if (offline && !args.dryRun) throw new Error('--offline is only for --dry-run');
  const images = loadImages('product-images.json');
  const categoryImages = loadImages('category-images.json');
  const bannerImages = loadImages('banner-images.json');
  const tailoringImages = loadImages('tailoring-images.json');
  let changes: number;
  if (offline) {
    console.log('offline simulation against an in-memory API (no credentials used, nothing is written anywhere)');
    changes = await runSeed({ api: new FakeApi(), run: new Runner(false), demoPassword: 'offline-placeholder', images, categoryImages, bannerImages, tailoringImages }, args.only);
  } else {
    const { api, demoPassword } = await getAdmin();
    changes = await runSeed({ api, run: new Runner(args.dryRun), demoPassword, images, categoryImages, bannerImages, tailoringImages, pause: () => sleep(100) }, args.only);
  }
  console.log(`${args.dryRun ? 'dry run: ' : ''}${changes} change(s)`);
}

if (isMainModule(import.meta.url)) main().catch(fail);
