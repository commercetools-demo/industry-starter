// node scripts/ensure-w.mjs [--apply] [--store <storeKey> ...]
// Workstream W prerequisite check (W-00). READ ONLY on the project's schema: it VERIFIES that the seed's custom types and product
// types exist with the attributes W relies on, and fails listing what is missing. It creates NO custom type and NO product type
// (the seed owns `malva-line`, `malva-return-item`, `malva-customer`, `malva-checkout`, `mau-cart-discount-fields`, `mau-pt-local-part`
// and `mau-pt-bundle`). Its only writes are demo custom objects marked `"demo": true`: two co-op campaigns (`malva-coop-campaigns`)
// and the default e-mail templates per store (`malva-email-templates`). Dry run unless `--apply`; prints every create or skip.
// Never creates `malva-customer-consent` (consent is the `marketingConsent` field of `malva-customer`) or `malva-order-audit`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect, fail, SEEDED_STORES } from './catalog-live.mjs';

export const EXPECTED_PROJECT = 'spec-test-b2b2c-automotive';

/** Custom types the seed owns; W only checks that they exist. */
export const REQUIRED_TYPES = ['malva-line', 'malva-customer', 'mau-cart-discount-fields'];

/** Attribute names each product type must carry (and, for the local part, must NOT carry). */
export const REQUIRED_ATTRIBUTES = {
  'mau-pt-part': { has: ['fitment-keys'], lacks: [] },
  'mau-pt-local-part': { has: ['part-number', 'brand-name', 'owner-store', 'review-state', 'recurring-eligible'], lacks: ['fitment-keys'] },
  'mau-pt-bundle': { has: ['part-number', 'component-skus', 'component-quantities', 'bundle-discount-percent', 'owner-store'], lacks: [] },
};

/** Problems of one product type: a missing type, missing attributes, or an attribute that must not exist. */
export function attributeProblems(key, productType) {
  const rule = REQUIRED_ATTRIBUTES[key];
  if (!productType) return [`product type ${key} is missing`];
  const names = new Set((productType.attributes ?? []).map((a) => a.name));
  return [
    ...rule.has.filter((n) => !names.has(n)).map((n) => `product type ${key} has no attribute ${n}`),
    ...rule.lacks.filter((n) => names.has(n)).map((n) => `product type ${key} must not have attribute ${n}`),
  ];
}

export function demoObjects(root, stores) {
  const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  const campaigns = read('lib/marketing/demo-data.json').campaigns.map((c) => ({ container: 'malva-coop-campaigns', key: c.key, value: { ...c, demo: true } }));
  const templates = read('lib/email/default-templates.json');
  const perStore = stores.flatMap((storeKey) =>
    Object.entries(templates).map(([name, template]) => ({ container: 'malva-email-templates', key: `${storeKey}--${name}`, value: { ...template, storeKey, demo: true, updatedAt: new Date().toISOString() } })),
  );
  return [...campaigns, ...perStore];
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const stores = argv.flatMap((a, i) => (argv[i - 1] === '--store' ? [a] : []));
  const targets = stores.length ? stores : Object.keys(SEEDED_STORES);
  const ctp = await connect();
  if (ctp.projectKey !== EXPECTED_PROJECT) fail(`Refusing project "${ctp.projectKey}": this script only runs against ${EXPECTED_PROJECT}.`);

  const problems = [];
  for (const key of REQUIRED_TYPES) {
    const found = await ctp.api('GET', `/types/key=${encodeURIComponent(key)}`).catch(() => null);
    console.log(`${found ? 'ok     ' : 'MISSING'} custom type ${key}`);
    if (!found) problems.push(`custom type ${key} is missing (the seed creates it; W never does)`);
  }
  for (const key of Object.keys(REQUIRED_ATTRIBUTES)) {
    const found = await ctp.api('GET', `/product-types/key=${encodeURIComponent(key)}`).catch(() => null);
    const issues = attributeProblems(key, found);
    console.log(`${issues.length ? 'PROBLEM ' : 'ok      '} product type ${key}`);
    problems.push(...issues);
  }
  if (problems.length) {
    console.error(`\nThe seed is incomplete; nothing was written:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`\nDemo records (${apply ? 'applying' : 'dry run, pass --apply to write'}):`);
  for (const object of demoObjects(process.cwd(), targets)) {
    const exists = await ctp.api('GET', `/custom-objects/${object.container}/${encodeURIComponent(object.key)}`).catch(() => null);
    if (exists) {
      console.log(`skip   ${object.container}/${object.key} (exists)`);
      continue;
    }
    console.log(`${apply ? 'create ' : 'would create'} ${object.container}/${object.key}`);
    if (apply) await ctp.api('POST', '/custom-objects', object);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
