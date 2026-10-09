import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildServiceTypeDraft, categoryDrafts, faqItemTypeDraft, KEYS, shippingMethodDraft, taxCategoryDraft, typeDrafts, zoneDraft } from './data/catalog';
import { DEMO_COMPANIES } from './data/demo';
import { COUNTRIES, LANGUAGES, ls } from './data/locales';
import { buildPortalDemo } from './data/portal-demo';
import { buildProductDraft, buildRelatedActions, type PickedImage } from './data/products';
import { roleDrafts } from './data/roles';
import { SERVICES, serviceKey } from './data/services';
import { DATA_DIR, findOne, getAdminRoot, parseArgs, Runner, sleep, type Root } from './lib';

/**
 * Creates everything the Malva site needs, in dependency order. Creates what is missing and leaves what exists
 * untouched (a second run reports 0 changes). To rebuild after changing seed data: `npm run reset` then `npm run seed`.
 *
 *   npx tsx src/seed.ts [--dry-run] [--only <step>]
 *
 * Steps: tax, zone, shipping, product-types, categories, types, roles, products, related, store, selection, demo, portal
 */
interface Ctx { root: Root; run: Runner; demoPassword: string }
type Step = { name: string; run: (ctx: Ctx) => Promise<void> };

const l = (text: string) => ls(text);
const pause = () => sleep(120);

async function ensure<T>(ctx: Ctx, label: string, get: () => Promise<{ body: T }>, create: () => Promise<unknown>): Promise<boolean> {
  if (await findOne(get)) return false;
  await ctx.run.act(`create ${label}`, create);
  await pause();
  return true;
}

const steps: Step[] = [
  {
    name: 'tax',
    run: (c) => ensure(c, `tax category ${taxCategoryDraft.key}`, () => c.root.taxCategories().withKey({ key: taxCategoryDraft.key as string }).get().execute(), () => c.root.taxCategories().post({ body: taxCategoryDraft }).execute()).then(() => undefined),
  },
  {
    name: 'zone',
    run: (c) => ensure(c, `zone ${zoneDraft.key}`, () => c.root.zones().withKey({ key: zoneDraft.key as string }).get().execute(), () => c.root.zones().post({ body: zoneDraft }).execute()).then(() => undefined),
  },
  {
    name: 'shipping',
    run: (c) => ensure(c, `shipping method ${shippingMethodDraft.key}`, () => c.root.shippingMethods().withKey({ key: shippingMethodDraft.key as string }).get().execute(), () => c.root.shippingMethods().post({ body: shippingMethodDraft }).execute()).then(() => undefined),
  },
  {
    name: 'product-types',
    run: async (c) => {
      await ensure(c, `product type ${faqItemTypeDraft.key}`, () => c.root.productTypes().withKey({ key: faqItemTypeDraft.key as string }).get().execute(), () => c.root.productTypes().post({ body: faqItemTypeDraft }).execute());
      // The nested FAQ attribute references the FAQ type by id, so it is looked up after it exists (placeholder in a dry run).
      const faq = await findOne(() => c.root.productTypes().withKey({ key: faqItemTypeDraft.key as string }).get().execute());
      const draft = buildServiceTypeDraft(faq?.id ?? 'dry-run-placeholder');
      await ensure(c, `product type ${draft.key}`, () => c.root.productTypes().withKey({ key: draft.key as string }).get().execute(), () => c.root.productTypes().post({ body: draft }).execute());
    },
  },
  {
    name: 'categories',
    run: async (c) => {
      for (const draft of categoryDrafts) {
        await ensure(c, `category ${draft.key}`, () => c.root.categories().withKey({ key: draft.key as string }).get().execute(), () => c.root.categories().post({ body: draft }).execute());
      }
    },
  },
  {
    name: 'types',
    run: async (c) => {
      for (const draft of typeDrafts) {
        await ensure(c, `custom type ${draft.key}`, () => c.root.types().withKey({ key: draft.key }).get().execute(), () => c.root.types().post({ body: draft }).execute());
      }
    },
  },
  {
    name: 'roles',
    run: async (c) => {
      for (const draft of roleDrafts) {
        await ensure(c, `associate role ${draft.key}`, () => c.root.associateRoles().withKey({ key: draft.key }).get().execute(), () => c.root.associateRoles().post({ body: draft }).execute());
        // Roles are the access contract: keep the permissions exactly as defined in data/roles.ts.
        const role = await findOne(() => c.root.associateRoles().withKey({ key: draft.key }).get().execute());
        const same = role && role.permissions.length === draft.permissions.length && draft.permissions.every((x) => role.permissions.includes(x));
        if (role && !same) {
          await c.run.act(`set permissions of associate role ${draft.key}`, () => c.root.associateRoles().withKey({ key: draft.key }).post({ body: { version: role.version, actions: [{ action: 'setPermissions', permissions: draft.permissions }] } }).execute());
        }
      }
    },
  },
  {
    name: 'products',
    run: async (c) => {
      const picked = readImages();
      for (const def of SERVICES) {
        const key = serviceKey(def.slug);
        await ensure(c, `product ${key}`, () => c.root.products().withKey({ key }).get().execute(), () => c.root.products().post({ body: buildProductDraft(def, picked[key] ?? []) }).execute());
      }
    },
  },
  {
    name: 'related',
    run: async (c) => {
      const idsBySlug: Record<string, string> = {};
      for (const def of SERVICES) {
        const p = await findOne(() => c.root.products().withKey({ key: serviceKey(def.slug) }).get().execute());
        if (p) idsBySlug[def.slug] = p.id;
      }
      for (const def of SERVICES) {
        const p = await findOne(() => c.root.products().withKey({ key: serviceKey(def.slug) }).get().execute());
        if (!p) continue; // dry run before products exist
        const has = p.masterData.current.masterVariant.attributes?.some((a) => a.name === 'related');
        const actions = buildRelatedActions(def, idsBySlug);
        if (has || actions.length === 0) continue;
        await c.run.act(`set related services of ${p.key}`, () => c.root.products().withKey({ key: p.key as string }).post({ body: { version: p.version, actions: [...actions, { action: 'publish' }] } }).execute());
        await pause();
      }
    },
  },
  {
    name: 'store',
    run: (c) => ensure(c, `store ${KEYS.store}`, () => c.root.stores().withKey({ key: KEYS.store }).get().execute(), () => c.root.stores().post({ body: { key: KEYS.store, name: l('Malva web'), languages: [...LANGUAGES], countries: COUNTRIES.map((code) => ({ code })) } }).execute()).then(() => undefined),
  },
  {
    name: 'selection',
    run: async (c) => {
      await ensure(c, `product selection ${KEYS.selection}`, () => c.root.productSelections().withKey({ key: KEYS.selection }).get().execute(), () => c.root.productSelections().post({ body: { key: KEYS.selection, name: l('All Malva services'), mode: 'Individual' } }).execute());
      const selection = await findOne(() => c.root.productSelections().withKey({ key: KEYS.selection }).get().execute());
      if (selection) {
        const current = (await c.root.productSelections().withKey({ key: KEYS.selection }).products().get({ queryArgs: { limit: 100 } }).execute()).body.results.map((r) => r.product.id);
        const missing: string[] = [];
        for (const def of SERVICES) {
          const p = await findOne(() => c.root.products().withKey({ key: serviceKey(def.slug) }).get().execute());
          if (p && !current.includes(p.id)) missing.push(p.id);
        }
        let version = selection.version;
        for (const id of missing) {
          const res = await c.run.act(`add product ${id} to ${KEYS.selection}`, () => c.root.productSelections().withKey({ key: KEYS.selection }).post({ body: { version, actions: [{ action: 'addProduct', product: { typeId: 'product', id } }] } }).execute());
          if (res) version = res.body.version;
        }
      }
      const store = await findOne(() => c.root.stores().withKey({ key: KEYS.store }).get().execute());
      if (store && !store.productSelections.some((s) => s.productSelection.obj?.key === KEYS.selection || s.productSelection.id)) {
        await c.run.act(`assign ${KEYS.selection} to store ${KEYS.store}`, () => c.root.stores().withKey({ key: KEYS.store }).post({ body: { version: store.version, actions: [{ action: 'setProductSelections', productSelections: [{ productSelection: { typeId: 'product-selection', key: KEYS.selection }, active: true }] }] } }).execute());
      }
    },
  },
  {
    name: 'demo',
    run: async (c) => {
      await createDemoCustomers(c);
      await createDemoCompanies(c);
    },
  },
  {
    name: 'portal',
    run: async (c) => {
      for (const o of buildPortalDemo()) {
        await ensure(c, `custom object ${o.container}/${o.key}`, () => c.root.customObjects().withContainerAndKey({ container: o.container, key: o.key }).get().execute(), () => c.root.customObjects().post({ body: { container: o.container, key: o.key, value: o.value } }).execute());
      }
    },
  },
];

async function createDemoCustomers(c: Ctx): Promise<void> {
  for (const company of DEMO_COMPANIES) {
    for (const u of company.users) {
      const exists = await findOne(() => c.root.customers().withKey({ key: u.key }).get().execute());
      if (exists) continue;
      await c.run.act(`create customer ${u.key}`, () =>
        c.root.customers().post({
          body: {
            key: u.key,
            email: u.email,
            password: c.demoPassword,
            firstName: u.firstName,
            lastName: u.lastName,
            isEmailVerified: true,
            custom: { type: { typeId: 'type', key: KEYS.typeCustomer }, fields: { jobTitle: u.jobTitle, phone: u.phone } },
          },
        }).execute(),
      );
      await pause();
    }
  }
}

async function createDemoCompanies(c: Ctx): Promise<void> {
  for (const company of DEMO_COMPANIES) {
    const exists = await findOne(() => c.root.businessUnits().withKey({ key: company.key }).get().execute());
    if (exists) continue;
    await c.run.act(`create company ${company.key}`, () =>
      c.root.businessUnits().post({
        body: {
          unitType: 'Company',
          key: company.key,
          name: company.name,
          status: 'Active',
          storeMode: 'Explicit',
          stores: [{ typeId: 'store', key: KEYS.store }],
          associateMode: 'Explicit',
          associates: company.users.map((u) => ({
            customer: { typeId: 'customer', key: u.key },
            associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: u.role } }],
          })),
          addresses: company.sites.map((s) => ({ key: s.key, country: 'US', streetName: s.streetName, city: s.city, postalCode: s.postalCode, company: s.name })),
          defaultShippingAddress: 0,
          custom: { type: { typeId: 'type', key: KEYS.typeCompany }, fields: { sector: company.sector } },
        },
      }).execute(),
    );
    await pause();
  }
}

function readImages(): Record<string, PickedImage[]> {
  const file = path.join(DATA_DIR, 'product-images.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, PickedImage[]>) : {};
}

export const STEP_NAMES = steps.map((s) => s.name);

async function main() {
  const { dryRun, only } = parseArgs(process.argv.slice(2));
  if (only && !STEP_NAMES.includes(only)) throw new Error(`Unknown step "${only}". Steps: ${STEP_NAMES.join(', ')}`);
  const { root } = await getAdminRoot();
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? '';
  if (demoPassword.length < 10) throw new Error('SEED_DEMO_PASSWORD must be set (at least 10 characters)');
  const run = new Runner(dryRun);
  const ctx: Ctx = { root, run, demoPassword };
  for (const step of steps) {
    if (only && step.name !== only) continue;
    run.note(`== ${step.name}`);
    await step.run(ctx);
  }
  console.log(`${dryRun ? 'dry run: ' : ''}${run.changes} change(s)`);
}

if (process.argv[1]?.endsWith('seed.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
