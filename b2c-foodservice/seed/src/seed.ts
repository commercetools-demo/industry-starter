// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import { ls } from './data/base';
import { categoryDrafts } from './data/categories';
import { categoryImagesFor, loadRecordedImages, productDrafts, productImagesFor, type ImageMap, type RecordedImage } from './data/catalog';
import { CUSTOMERS, customerDraft, shoppingListDraft } from './data/customers';
import { typeDrafts } from './data/custom-types';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { productTypeDrafts } from './data/product-types';
import { PRODUCTS } from './data/products';
import { reviewDrafts } from './data/reviews';
import { orderStateDrafts, reviewStateDrafts } from './data/states';
import { channelDrafts } from './data/stores';
import { shippingMethodDrafts, taxCategoryDrafts, zoneDrafts } from './data/tax-shipping';
import { FakeApi } from './fake-api';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';
import { ensureProjectSettings } from './settings';
import * as S from './sync';

/**
 * Creates and updates everything the Malva Coffee storefront needs, in dependency order. Idempotent by key: a second
 * run reports 0 changes. Reads first, writes only the difference.
 *
 *   npm run seed [-- --dry-run] [-- --only <step[,step]>] [-- --offline]
 *
 * `--dry-run` reads the project and prints what would change, writing nothing.
 * `--dry-run --offline` needs no credentials: it runs the whole seed against an in-memory fake API and prints the plan
 * a fresh project would get.
 * `--only` runs just those steps; a step whose prerequisites are neither in the run nor in the project is skipped and
 * reported, never created silently.
 */
type Obj = Record<string, unknown>;
export interface SeedOptions {
  api: Api;
  run: Runner;
  demoPassword: string;
  /** Recorded photos (src/data/images.json). Empty means: seed without images, a later run adds them. */
  recordedImages?: RecordedImage[];
  pause?: () => Promise<void>;
}

export class Ctx {
  readonly api: Api;
  readonly run: Runner;
  readonly demoPassword: string;
  readonly images: ImageMap;
  readonly categoryImages: ImageMap;
  readonly pause: () => Promise<void>;
  readonly skipped: string[] = [];
  private readonly idKeys = new Map<string, Map<string, string>>();

  constructor(o: SeedOptions) {
    this.api = o.api; this.run = o.run; this.demoPassword = o.demoPassword;
    this.images = productImagesFor(o.recordedImages ?? []);
    this.categoryImages = categoryImagesFor(o.recordedImages ?? []);
    this.pause = o.pause ?? (() => Promise.resolve());
  }

  /** id -> key lookup for one reference type, loaded once per step (refresh after creating resources of that kind). */
  async loadKeys(typeId: string, kind: Kind): Promise<void> {
    const m = new Map<string, string>();
    for (const r of await this.api.list(kind)) if (r.key) m.set(r.id, r.key);
    this.idKeys.set(typeId, m);
  }

  keyOf: S.KeyOf = (typeId, id) => this.idKeys.get(typeId)?.get(id);
}

/** Creates a resource when it is missing, otherwise applies `plan(existing)` actions. Returns the resource (undefined in a dry run that creates). */
export async function upsert(ctx: Ctx, kind: Kind, label: string, draft: Obj, plan?: (existing: Res) => S.Action[]): Promise<Res | undefined> {
  const key = draft.key as string;
  const existing = await ctx.api.getByKey(kind, key);
  if (!existing) {
    const created = await ctx.run.act(`create ${label}`, () => ctx.api.create(kind, draft));
    await ctx.pause();
    return created;
  }
  const actions = plan ? plan(existing) : [];
  if (actions.length === 0) return existing;
  const updated = await ctx.run.act(`update ${label} (${[...new Set(actions.map((a) => String(a.action)))].join(', ')})`, () => ctx.api.update(kind, existing, actions));
  await ctx.pause();
  return updated ?? existing;
}

export interface Step { name: string; requires: { step: string; kind: Kind; key: string }[]; run: (ctx: Ctx) => Promise<void> }

const first = <T>(xs: T[]): T => xs[0] as T;
const productKey = (): string => first(PRODUCTS).key;

export const STEPS: Step[] = [
  { name: 'settings', requires: [], run: (c) => ensureProjectSettings(c.api, c.run) },
  {
    name: 'tax', requires: [],
    run: async (c) => {
      for (const t of taxCategoryDrafts) await upsert(c, 'tax-categories', `tax category ${t.key}`, t as unknown as Obj, (e) => S.planTaxUpdate(e, t as never));
    },
  },
  {
    name: 'shipping', requires: [{ step: 'tax', kind: 'tax-categories', key: 'mcf-tax-standard' }],
    run: async (c) => {
      for (const z of zoneDrafts) await upsert(c, 'zones', `zone ${z.key}`, z as unknown as Obj);
      await c.loadKeys('zone', 'zones');
      for (const s of shippingMethodDrafts) await upsert(c, 'shipping-methods', `shipping method ${s.key}`, s as unknown as Obj, (e) => S.planShippingUpdate(e, s as never, c.keyOf));
    },
  },
  {
    // Targets first (collected before ready), so every transition resolves.
    name: 'states', requires: [],
    run: async (c) => {
      for (const s of [...orderStateDrafts()].reverse()) {
        await upsert(c, 'states', `order state ${s.key}`, s as unknown as Obj, (e) => S.planStateUpdate(e, s as never, c.keyOf));
        await c.loadKeys('state', 'states');
      }
    },
  },
  {
    name: 'types', requires: [],
    run: async (c) => {
      for (const t of typeDrafts) await upsert(c, 'types', `custom type ${t.key}`, t as unknown as Obj, (e) => S.planTypeUpdate(e, t));
    },
  },
  {
    name: 'product-types', requires: [],
    run: async (c) => {
      for (const p of productTypeDrafts) await upsert(c, 'product-types', `product type ${p.key}`, p as unknown as Obj, (e) => S.planProductTypeUpdate(e, p));
    },
  },
  {
    name: 'categories', requires: [],
    run: async (c) => {
      for (const d of categoryDrafts()) {
        const images = c.categoryImages[d.key as string] ?? [];
        const assets = images.map((i, n) => ({ key: `image-${n + 1}`, name: ls('Image', 'Bild'), sources: [{ uri: i.url, dimensions: i.dimensions, contentType: 'image/jpeg' }], tags: ['image'] }));
        await upsert(c, 'categories', `category ${d.key}`, { ...d, ...(assets.length ? { assets } : {}) } as unknown as Obj, (e) => S.planCategoryUpdate(e, { name: d.name, assets }));
      }
    },
  },
  {
    name: 'channels', requires: [{ step: 'types', kind: 'types', key: 'mcf-store' }],
    run: async (c) => {
      for (const ch of channelDrafts()) await upsert(c, 'channels', `store channel ${ch.key}`, ch as unknown as Obj, (e) => S.planChannelUpdate(e, ch as never));
    },
  },
  {
    name: 'recurrence', requires: [],
    run: async (c) => {
      for (const r of recurrencePolicyDrafts) await upsert(c, 'recurrence-policies', `recurrence policy ${r.key}`, r as unknown as Obj);
    },
  },
  {
    // Products with names, descriptions, attributes and (once recorded) images; prices come with the `prices` step.
    name: 'products',
    requires: [
      { step: 'product-types', kind: 'product-types', key: 'mcf-pods' }, { step: 'categories', kind: 'categories', key: 'mcf-cat-pods' },
      { step: 'tax', kind: 'tax-categories', key: 'mcf-tax-food' },
    ],
    run: async (c) => {
      await c.loadKeys('recurrence-policy', 'recurrence-policies');
      for (const d of productDrafts(c.images, false)) await upsert(c, 'products', `product ${d.key}`, d, (e) => S.planProductUpdate(e, d as never, c.keyOf, 'core'));
    },
  },
  {
    // Embedded prices on every variant, including recurrencePrices for subscribable products.
    name: 'prices',
    requires: [{ step: 'products', kind: 'products', key: productKey() }, { step: 'recurrence', kind: 'recurrence-policies', key: 'mcf-every-month' }],
    run: async (c) => {
      await c.loadKeys('recurrence-policy', 'recurrence-policies');
      for (const d of productDrafts({}, true)) {
        const existing = await c.api.getByKey('products', d.key as string);
        if (!existing) {
          await c.run.act(`set prices on product ${d.key} (after it is created)`, async () => undefined);
          continue;
        }
        const actions = S.planProductUpdate(existing, d as never, c.keyOf, 'prices');
        if (actions.length === 0) continue;
        await c.run.act(`update prices of product ${d.key} (${actions.filter((a) => a.action === 'setPrices').length} variant(s))`, () => c.api.update('products', existing, actions));
        await c.pause();
      }
    },
  },
  {
    name: 'inventory',
    requires: [{ step: 'products', kind: 'products', key: productKey() }, { step: 'channels', kind: 'channels', key: 'mcf-store-nyc-soho' }],
    run: async (c) => {
      for (const d of inventoryDrafts()) await upsert(c, 'inventory', `inventory ${d.key}`, d as unknown as Obj, (e) => S.planInventoryUpdate(e, d));
    },
  },
  {
    name: 'discounts', requires: [],
    run: async (c) => {
      for (const d of productDiscountDrafts()) await upsert(c, 'product-discounts', `product discount ${d.key}`, d as unknown as Obj, (e) => S.planDiscountUpdate('product-discounts', e, d));
      for (const d of cartDiscountDrafts) await upsert(c, 'cart-discounts', `cart discount ${d.key}`, d as unknown as Obj, (e) => S.planDiscountUpdate('cart-discounts', e, d));
      for (const d of discountCodeDrafts) await upsert(c, 'discount-codes', `discount code ${d.key} (${d.code})`, d as unknown as Obj);
    },
  },
  {
    name: 'customers', requires: [],
    run: async (c) => {
      if (!c.run.dryRun && c.demoPassword.length < 10) throw new Error('SEED_DEMO_PASSWORD must be set and at least 10 characters');
      for (const cu of CUSTOMERS) await upsert(c, 'customers', `customer ${cu.email}`, customerDraft(cu, c.demoPassword || 'dry-run-placeholder'));
      // Accounts created earlier (or by another tool) may still be unverified: every demo account is verified.
      for (const cu of CUSTOMERS) {
        const existing = await c.api.getByKey('customers', cu.key);
        if (existing && existing.isEmailVerified !== true) await c.run.act(`verify email ${cu.email}`, () => c.api.verifyCustomerEmail(existing));
      }
    },
  },
  {
    name: 'shopping-lists',
    requires: [{ step: 'customers', kind: 'customers', key: 'mcf-customer-maya' }, { step: 'products', kind: 'products', key: productKey() }],
    run: async (c) => {
      const d = shoppingListDraft();
      await upsert(c, 'shopping-lists', `shopping list ${d.key}`, d as unknown as Obj);
    },
  },
  {
    // Approved is the target of pending, so it is created first.
    name: 'review-states', requires: [],
    run: async (c) => {
      for (const s of [...reviewStateDrafts()].reverse()) {
        await upsert(c, 'states', `review state ${s.key}`, s as unknown as Obj, (e) => S.planStateUpdate(e, s as never, c.keyOf));
        await c.loadKeys('state', 'states');
      }
    },
  },
  {
    // Reviews through the Reviews API, approved, so `reviewRatingStatistics` exists on the product.
    name: 'reviews',
    requires: [
      { step: 'products', kind: 'products', key: productKey() }, { step: 'customers', kind: 'customers', key: 'mcf-customer-maya' },
      { step: 'review-states', kind: 'states', key: 'mcf-review-approved' },
    ],
    run: async (c) => {
      await c.loadKeys('state', 'states');
      for (const d of reviewDrafts()) await upsert(c, 'reviews', `review ${d.key}`, d as unknown as Obj, (e) => S.planReviewUpdate(e, d as never, c.keyOf));
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

/** Prerequisites that are neither part of this run nor present in the project. */
async function missingPrerequisites(ctx: Ctx, step: Step, selected: Step[]): Promise<string[]> {
  const out: string[] = [];
  for (const r of step.requires) {
    if (selected.some((s) => s.name === r.step)) continue;
    if (!(await ctx.api.getByKey(r.kind, r.key))) out.push(`${r.kind} ${r.key} (step ${r.step})`);
  }
  return out;
}

export interface SeedResult { changes: number; perStep: { step: string; changes: number }[]; skipped: string[] }

export async function runSeed(o: SeedOptions, only?: string): Promise<SeedResult> {
  const ctx = new Ctx(o);
  const selected = selectSteps(only);
  const perStep: SeedResult['perStep'] = [];
  for (const step of selected) {
    const missing = await missingPrerequisites(ctx, step, selected);
    if (missing.length > 0) {
      const line = `== ${step.name}: SKIPPED, missing prerequisite ${missing.join(', ')}. Run those steps first.`;
      ctx.run.note(line);
      ctx.skipped.push(line);
      continue;
    }
    ctx.run.note(`== ${step.name}`);
    const before = ctx.run.changes;
    await step.run(ctx);
    perStep.push({ step: step.name, changes: ctx.run.changes - before });
  }
  return { changes: ctx.run.changes, perStep, skipped: ctx.skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.offline && !args.dryRun) throw new Error('--offline is only for --dry-run');
  const recordedImages = loadRecordedImages();
  let result: SeedResult;
  if (args.offline) {
    console.log('offline simulation against an in-memory API (no credentials used, nothing is written anywhere)');
    result = await runSeed({ api: new FakeApi(), run: new Runner(false), demoPassword: 'offline-placeholder', recordedImages }, args.only);
  } else {
    const { api, demoPassword } = await getAdmin();
    result = await runSeed({ api, run: new Runner(args.dryRun), demoPassword, recordedImages, pause: () => sleep(100) }, args.only);
  }
  console.log('\nplan by step:');
  for (const s of result.perStep) console.log(`  ${s.step.padEnd(16)} ${String(s.changes).padStart(5)}`);
  console.log(`${args.dryRun ? 'dry run: ' : ''}${result.changes} change(s)`);
  if (result.skipped.length) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
