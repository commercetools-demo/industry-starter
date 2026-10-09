import { KEYS } from './data/catalog';
import { DEMO_COMPANIES } from './data/demo';
import { CURRENCIES } from './data/locales';
import { roleDrafts } from './data/roles';
import { SERVICES, serviceKey } from './data/services';
import { findOne, getAdminRoot, isCleanUrl } from './lib';

/**
 * Read-back assertions after a seed run (the SEED-PLAN "Verification" list). Exits 1 when anything is wrong.
 *   npx tsx src/verify.ts
 */
export interface ProductView {
  key?: string;
  masterData: { published: boolean; current: { masterVariant: { sku?: string; prices?: { value: { currencyCode: string; centAmount: number } }[]; images?: { url: string }[] }; categories: { id: string }[] } };
}

/** Problems with one seeded service product (pure; unit tested). */
export function checkServiceProduct(p: ProductView): string[] {
  const out: string[] = [];
  const key = p.key ?? '(no key)';
  if (!p.key?.startsWith('mpw-svc-')) out.push(`${key}: key must start with mpw-svc-`);
  if (!p.masterData.published) out.push(`${key}: not published`);
  const v = p.masterData.current.masterVariant;
  for (const currency of CURRENCIES) {
    const price = v.prices?.find((x) => x.value.currencyCode === currency);
    if (!price) out.push(`${key}: no ${currency} price (a service without one cannot be added to a cart in that currency)`);
    else if (price.value.centAmount !== 0) out.push(`${key}: ${currency} price must be 0, found ${price.value.centAmount}`);
  }
  if (!v.images || v.images.length === 0) out.push(`${key}: no images (add images in src/data/product-images.json)`);
  for (const i of v.images ?? []) if (!isCleanUrl(i.url)) out.push(`${key}: image URL is not clean: ${i.url}`);
  if (p.masterData.current.categories.length !== 1) out.push(`${key}: must be in exactly one category`);
  return out;
}

async function main() {
  const { root } = await getAdminRoot();
  const problems: string[] = [];
  const project = (await root.get().execute()).body;
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') problems.push('project: Product Search (ProductsSearch) is not Activated');
  if (project.carts?.countryTaxRateFallbackEnabled !== true) problems.push('project: countryTaxRateFallbackEnabled is not true');
  for (const def of SERVICES) {
    const p = await findOne(() => root.products().withKey({ key: serviceKey(def.slug) }).get().execute());
    if (!p) problems.push(`${serviceKey(def.slug)}: missing`);
    else problems.push(...checkServiceProduct(p as unknown as ProductView));
  }
  for (const key of [KEYS.categoryPlumbing, KEYS.categoryWaste]) if (!(await findOne(() => root.categories().withKey({ key }).get().execute()))) problems.push(`category ${key}: missing`);
  const store = await findOne(() => root.stores().withKey({ key: KEYS.store }).get().execute());
  if (!store) problems.push(`store ${KEYS.store}: missing`);
  else if (store.productSelections.length === 0) problems.push(`store ${KEYS.store}: no product selection assigned`);
  for (const role of roleDrafts) {
    const r = await findOne(() => root.associateRoles().withKey({ key: role.key }).get().execute());
    if (!r) problems.push(`associate role ${role.key}: missing`);
    else {
      const missing = role.permissions.filter((x) => !r.permissions.includes(x));
      if (missing.length > 0) problems.push(`associate role ${role.key}: missing permissions ${missing.join(', ')}`);
    }
  }
  for (const c of DEMO_COMPANIES) if (!(await findOne(() => root.businessUnits().withKey({ key: c.key }).get().execute()))) problems.push(`business unit ${c.key}: missing`);
  try {
    const res = await root.products().search().post({ body: { query: { exact: { field: 'categories', value: 'x' } }, limit: 1 } as never }).execute();
    void res;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 400 || status === 404) console.log('note: Product Search answered', status, 'to the probe query; verify search through the Merchant Center MCP (read_product_search)');
    else problems.push(`Product Search probe failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (problems.length > 0) {
    console.error(problems.map((p) => `PROBLEM ${p}`).join('\n'));
    console.error(`verify: FAILED (${problems.length})`);
    process.exit(1);
  }
  console.log('verify: OK');
}

if (process.argv[1]?.endsWith('verify.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
