import categories from './data/categories.json';
import productType from './data/product-type.json';
import recurrence from './data/recurrence.json';
import shippingTax from './data/shipping-tax.json';
import types from './data/types.json';
import { DEFS, buildProductDrafts, skuQuantities, substituteMap } from './data/catalog';
import {
  ensureCategory, ensureInventory, ensureProduct, ensureProductType, ensureRecurrencePolicy,
  ensureShippingMethod, ensureTaxCategory, ensureType, ensureZone, getAdminRoot, runSteps, type EnsureResult, type Root,
} from './lib';

export function shippingMethodDraft() {
  const m = shippingTax.shippingMethod;
  return {
    key: m.key,
    name: m.name,
    localizedName: m.localizedName,
    taxCategory: { typeId: 'tax-category', key: m.taxCategoryKey },
    isDefault: m.isDefault,
    zoneRates: m.rates.map((r) => ({
      zone: { typeId: 'zone', key: r.zoneKey },
      shippingRates: [{
        price: { currencyCode: r.currency, centAmount: r.centAmount },
        freeAbove: { currencyCode: r.currency, centAmount: r.freeAboveCentAmount },
      }],
    })),
  };
}

async function linkSubstitutes(root: Root): Promise<void> {
  const ids = new Map<string, string>();
  for (const d of DEFS) ids.set(d.key, (await root.products().withKey({ key: d.key }).get().execute()).body.id);
  for (const [key, sub] of Object.entries(substituteMap())) {
    const product = (await root.products().withKey({ key }).get().execute()).body;
    await root.products().withKey({ key }).post({
      body: { version: product.version, actions: [{ action: 'setProductAttribute', name: 'substituteProducts', value: [{ typeId: 'product', id: ids.get(sub) }], staged: false }] },
    }).execute();
  }
}

async function main() {
  const { root } = getAdminRoot();
  const step = (name: string, run: () => Promise<EnsureResult>) => ({ name, run });
  const steps = [
    ...types.map((t) => step(`type ${t.key}`, () => ensureType(root, t))),
    step(`product type ${productType.key}`, () => ensureProductType(root, productType)),
    ...categories.map((c) => step(`category ${c.key}`, () => ensureCategory(root, c))),
    ...shippingTax.taxCategories.map((t) => step(`tax ${t.key}`, () => ensureTaxCategory(root, t))),
    ...shippingTax.zones.map((z) => step(`zone ${z.key}`, () => ensureZone(root, z))),
    step('shipping standard', () => ensureShippingMethod(root, shippingMethodDraft())),
    ...recurrence.map((p) => step(`recurrence ${p.key}`, () => ensureRecurrencePolicy(root, p))),
    ...buildProductDrafts().map((p) => step(`product ${String(p.key)}`, () => ensureProduct(root, p as { key: string }))),
    ...skuQuantities().map((i) => step(`inventory ${i.sku}`, () => ensureInventory(root, i.sku, i.quantity))),
  ];
  if (!(await runSteps(steps))) process.exit(1);
  await linkSubstitutes(root);
  console.log('substitutes linked');
}

if (process.argv[1]?.endsWith('seed.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
