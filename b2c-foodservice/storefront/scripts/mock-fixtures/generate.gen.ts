// Writes scripts/mock-fixtures/seed-fixtures.json from the seed package's data modules (workstream G).
// The mock commercetools server (scripts/mock-ct-server.mjs) serves this JSON so the storefront can be driven in a
// browser with no credentials. Run (from storefront/) after the seed data changes:
//   npx vitest run --config scripts/mock-fixtures/vitest.gen.config.mts
// It only reads the seed's TypeScript data; nothing here touches a commercetools project.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { CATEGORIES, orderHint } from '../../../seed/src/data/categories';
import { quantityFor, recurrencePolicyDrafts } from '../../../seed/src/data/extras';
import { productTypeDrafts } from '../../../seed/src/data/product-types';
import { PRODUCTS } from '../../../seed/src/data/products';
import { priceDefsOf } from '../../../seed/src/data/prices';
import { expectedStats, REVIEWS } from '../../../seed/src/data/reviews';
import { STORES } from '../../../seed/src/data/stores';

it('writes the mock fixtures', () => {
  const products = PRODUCTS.map((p, i) => ({
    code: p.code, key: p.key, kind: p.kind, name: p.name, slug: p.slug, description: p.description,
    categories: p.categories, productType: p.productType, common: p.common, order: i,
    stats: expectedStats(p.key),
    ratings: REVIEWS.filter((r) => r.productKey === p.key).map((r) => r.rating),
    variants: p.variants.map((v) => ({
      sku: v.sku, attrs: v.attrs,
      prices: priceDefsOf(p, v).filter((x) => !x.policy).map((x) => ({ country: x.country, currency: x.currency, cents: x.cents })),
      stock: { online: quantityFor(v.sku, p.code), stores: STORES.map((s) => quantityFor(v.sku, p.code, s.key)) },
    })),
  }));
  const out = {
    categories: CATEGORIES.map((c) => ({ key: c.key, parent: c.parent ?? null, name: c.en, slug: c.slugEn, orderHint: orderHint(c) })),
    stores: STORES,
    productTypes: productTypeDrafts.map((t) => ({ key: t.key, name: t.name, attributes: t.attributes })),
    recurrencePolicies: recurrencePolicyDrafts.map((r) => r.key),
    products,
  };
  writeFileSync(join(process.cwd(), 'scripts/mock-fixtures/seed-fixtures.json'), `${JSON.stringify(out)}\n`);
});
