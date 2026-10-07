import { DEFS, skuQuantities, substituteMap } from './data/catalog';
import { getAdminRoot, type Root } from './lib';

export interface Check { name: string; ok: boolean; detail?: string }

export async function runChecks(root: Root): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail });

  const project = (await root.get().execute()).body;
  add('countries US, DE', ['US', 'DE'].every((c) => project.countries.includes(c)));
  add('currencies USD, EUR', ['USD', 'EUR'].every((c) => project.currencies.includes(c)));
  add('languages en-US, de-DE', ['en-US', 'de-DE'].every((l) => project.languages.includes(l)));
  add('product search indexing activated (OA-04)', project.searchIndexing?.productsSearch?.status === 'Activated', 'If this fails the owner activates it in Merchant Center (OA-04).');

  for (const key of ['cart-delivery', 'order-final', 'line-substitution', 'substitution-proposal']) {
    add(`custom type ${key}`, await exists(() => root.types().withKey({ key }).get().execute()));
  }
  add('product type grocery-product', await exists(() => root.productTypes().withKey({ key: 'grocery-product' }).get().execute()));
  for (const key of ['fresh-produce', 'dairy-eggs', 'bakery', 'pantry', 'drinks', 'household']) {
    add(`category ${key}`, await exists(() => root.categories().withKey({ key }).get().execute()));
  }
  for (const key of ['food', 'non-food']) add(`tax category ${key}`, await exists(() => root.taxCategories().withKey({ key }).get().execute()));
  const std = await maybe(() => root.shippingMethods().withKey({ key: 'standard' }).get().execute());
  add('shipping method standard (US and DE zone rates)', !!std && std.zoneRates.length === 2);
  for (const key of ['weekly', 'every-2-weeks', 'monthly']) add(`recurrence policy ${key}`, await exists(() => root.recurrencePolicies().withKey({ key }).get().execute()));

  const products = (await root.productProjections().get({ queryArgs: { limit: 100, where: 'productType(id is defined)', staged: false } }).execute()).body.results;
  const grocery = products.filter((p) => DEFS.some((d) => d.key === p.key));
  add('36 grocery products published', grocery.length === 36, `found ${grocery.length}`);
  const withSubs = grocery.filter((p) => (p.masterVariant.attributes ?? []).some((a) => a.name === 'substituteProducts'));
  add('substitutes linked', withSubs.length >= Object.keys(substituteMap()).length, `found ${withSubs.length}`);
  const noPrice = grocery.filter((p) => [p.masterVariant, ...p.variants].some((v) => (v.prices ?? []).length !== 2));
  add('every variant has USD/US and EUR/DE prices', noPrice.length === 0, noPrice.map((p) => p.key).join(', '));

  const inv = (await root.inventory().get({ queryArgs: { limit: 500 } }).execute()).body.results;
  const have = new Map(inv.map((i) => [i.sku, i.quantityOnStock]));
  const missing = skuQuantities().filter((q) => have.get(q.sku) !== q.quantity);
  add('inventory for every SKU (3 products out of stock)', missing.length === 0, missing.map((m) => m.sku).join(', '));
  return checks;
}

async function exists(call: () => Promise<{ body: unknown }>): Promise<boolean> {
  return (await maybe(call)) !== null;
}
async function maybe<T>(call: () => Promise<{ body: T }>): Promise<T | null> {
  try { return (await call()).body; } catch (e) { if ((e as { statusCode?: number }).statusCode === 404) return null; throw e; }
}

async function main() {
  const { root } = getAdminRoot();
  const checks = await runChecks(root);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok || !c.detail ? '' : `  (${c.detail})`}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

if (process.argv[1]?.endsWith('verify.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
