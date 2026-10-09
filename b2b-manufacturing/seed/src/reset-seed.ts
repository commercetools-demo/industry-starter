import { KEYS } from './data/catalog';
import { DEMO_COMPANIES } from './data/demo';
import { buildPortalDemo } from './data/portal-demo';
import { roleDrafts } from './data/roles';
import { SERVICES, serviceKey } from './data/services';
import { findOne, getAdminRoot, parseArgs, Runner, type Root } from './lib';

/**
 * Deletes ONLY what the seed creates (the explicit key lists below, all `mpw-` prefixed), in reverse dependency order.
 *   npx tsx src/reset-seed.ts --confirm <projectKey> [--dry-run]
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { root, env } = await getAdminRoot();
  if (args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}"`);
  const run = new Runner(args.dryRun);
  await removeAll(root, run);
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s)`);
}

async function removeAll(root: Root, run: Runner): Promise<void> {
  for (const o of buildPortalDemo()) {
    if (await findOne(() => root.customObjects().withContainerAndKey({ container: o.container, key: o.key }).get().execute())) {
      await run.act(`delete custom object ${o.container}/${o.key}`, () => root.customObjects().withContainerAndKey({ container: o.container, key: o.key }).delete().execute());
    }
  }
  for (const c of DEMO_COMPANIES) {
    const bu = await findOne(() => root.businessUnits().withKey({ key: c.key }).get().execute());
    if (bu) await run.act(`delete business unit ${c.key}`, () => root.businessUnits().withKey({ key: c.key }).delete({ queryArgs: { version: bu.version } }).execute());
    for (const u of c.users) {
      const cu = await findOne(() => root.customers().withKey({ key: u.key }).get().execute());
      if (cu) await run.act(`delete customer ${u.key}`, () => root.customers().withKey({ key: u.key }).delete({ queryArgs: { version: cu.version } }).execute());
    }
  }
  const store = await findOne(() => root.stores().withKey({ key: KEYS.store }).get().execute());
  if (store) await run.act(`delete store ${KEYS.store}`, () => root.stores().withKey({ key: KEYS.store }).delete({ queryArgs: { version: store.version } }).execute());
  const sel = await findOne(() => root.productSelections().withKey({ key: KEYS.selection }).get().execute());
  if (sel) await run.act(`delete product selection ${KEYS.selection}`, () => root.productSelections().withKey({ key: KEYS.selection }).delete({ queryArgs: { version: sel.version } }).execute());
  for (const def of SERVICES) {
    const key = serviceKey(def.slug);
    const p = await findOne(() => root.products().withKey({ key }).get().execute());
    if (!p) continue;
    await run.act(`delete product ${key}`, async () => {
      let version = p.version;
      if (p.masterData.published) version = (await root.products().withKey({ key }).post({ body: { version, actions: [{ action: 'unpublish' }] } }).execute()).body.version;
      await root.products().withKey({ key }).delete({ queryArgs: { version } }).execute();
    });
  }
  for (const key of [KEYS.categoryPlumbing, KEYS.categoryWaste]) {
    const c = await findOne(() => root.categories().withKey({ key }).get().execute());
    if (c) await run.act(`delete category ${key}`, () => root.categories().withKey({ key }).delete({ queryArgs: { version: c.version } }).execute());
  }
  for (const key of [KEYS.serviceType, KEYS.faqType]) {
    const t = await findOne(() => root.productTypes().withKey({ key }).get().execute());
    if (t) await run.act(`delete product type ${key}`, () => root.productTypes().withKey({ key }).delete({ queryArgs: { version: t.version } }).execute());
  }
  for (const r of roleDrafts) {
    const role = await findOne(() => root.associateRoles().withKey({ key: r.key }).get().execute());
    if (role) await run.act(`delete associate role ${r.key}`, () => root.associateRoles().withKey({ key: r.key }).delete({ queryArgs: { version: role.version } }).execute());
  }
  const sm = await findOne(() => root.shippingMethods().withKey({ key: KEYS.shippingMethod }).get().execute());
  if (sm) await run.act(`delete shipping method ${KEYS.shippingMethod}`, () => root.shippingMethods().withKey({ key: KEYS.shippingMethod }).delete({ queryArgs: { version: sm.version } }).execute());
  const tc = await findOne(() => root.taxCategories().withKey({ key: KEYS.taxCategory }).get().execute());
  if (tc) await run.act(`delete tax category ${KEYS.taxCategory}`, () => root.taxCategories().withKey({ key: KEYS.taxCategory }).delete({ queryArgs: { version: tc.version } }).execute());
  const z = await findOne(() => root.zones().withKey({ key: KEYS.zone }).get().execute());
  if (z) await run.act(`delete zone ${KEYS.zone}`, () => root.zones().withKey({ key: KEYS.zone }).delete({ queryArgs: { version: z.version } }).execute());
  for (const key of [KEYS.typeLine, KEYS.typeQuoteRequest, KEYS.typeCustomer, KEYS.typeCompany]) {
    const t = await findOne(() => root.types().withKey({ key }).get().execute());
    if (t) await run.act(`delete custom type ${key}`, () => root.types().withKey({ key }).delete({ queryArgs: { version: t.version } }).execute());
  }
}

if (process.argv[1]?.endsWith('reset-seed.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
