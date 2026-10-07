import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getAdminRoot, type Root } from './lib';

export const BACKUP_FILE = path.resolve(process.cwd(), '..', 'plan', 'backup', 'decor-backup.json');
const GROCERY_TYPE = 'grocery-product';

/** Read-only: dump everything that is NOT grocery to a gitignored backup file. */
export async function exportDecor(root: Root) {
  const productTypes = (await root.productTypes().get({ queryArgs: { limit: 100 } }).execute()).body.results.filter((t) => t.key !== GROCERY_TYPE);
  const typeIds = new Set(productTypes.map((t) => t.id));
  const products = (await root.products().get({ queryArgs: { limit: 500 } }).execute()).body.results.filter((p) => typeIds.has(p.productType.id));
  const groceryCats = new Set(['fresh-produce', 'dairy-eggs', 'bakery', 'pantry', 'drinks', 'household']);
  const categories = (await root.categories().get({ queryArgs: { limit: 500 } }).execute()).body.results.filter((c) => !groceryCats.has(c.key ?? ''));
  const skus = new Set(products.flatMap((p) => [p.masterData.current.masterVariant, ...p.masterData.current.variants].map((v) => v.sku).filter(Boolean)));
  const inventory = (await root.inventory().get({ queryArgs: { limit: 500 } }).execute()).body.results.filter((i) => skus.has(i.sku));
  return { exportedAt: new Date().toISOString(), productTypes, products, categories, inventory };
}

async function main() {
  const { root } = getAdminRoot();
  const data = await exportDecor(root);
  mkdirSync(path.dirname(BACKUP_FILE), { recursive: true });
  writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
  console.log(`backup written: ${data.products.length} products, ${data.productTypes.length} product types, ${data.categories.length} categories, ${data.inventory.length} inventory entries -> ${BACKUP_FILE}`);
}

if (process.argv[1]?.endsWith('export-decor.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
