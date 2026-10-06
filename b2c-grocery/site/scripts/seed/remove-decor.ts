import { existsSync, readFileSync } from 'node:fs';
import { BACKUP_FILE } from './export-decor';
import { getAdminRoot, type Root } from './lib';

interface Backup {
  products: { id: string; key?: string; version: number; masterData: { published: boolean } }[];
  productTypes: { id: string; key?: string; version: number }[];
  categories: { id: string; key?: string; version: number; ancestors: unknown[] }[];
  inventory: { id: string; version: number }[];
}

/** Deletes ONLY what is listed in the backup file: products → inventory → categories (deepest first) → product types. */
export async function removeDecor(root: Root, backup: Backup, opts: { confirm: boolean }, log: (l: string) => void = console.log) {
  const plan = `${backup.products.length} products, ${backup.inventory.length} inventory entries, ${backup.categories.length} categories, ${backup.productTypes.length} product types`;
  if (!opts.confirm) {
    log(`DRY RUN (add --confirm to delete): ${plan}`);
    return false;
  }
  for (const p of backup.products) {
    let version = p.version;
    if (p.masterData.published) {
      version = (await root.products().withId({ ID: p.id }).post({ body: { version, actions: [{ action: 'unpublish' }] } }).execute()).body.version;
    }
    await root.products().withId({ ID: p.id }).delete({ queryArgs: { version } }).execute();
  }
  for (const i of backup.inventory) await root.inventory().withId({ ID: i.id }).delete({ queryArgs: { version: i.version } }).execute();
  const deepestFirst = [...backup.categories].sort((a, b) => b.ancestors.length - a.ancestors.length);
  for (const c of deepestFirst) await root.categories().withId({ ID: c.id }).delete({ queryArgs: { version: c.version } }).execute();
  for (const t of backup.productTypes) await root.productTypes().withId({ ID: t.id }).delete({ queryArgs: { version: t.version } }).execute();
  log(`deleted: ${plan}`);
  return true;
}

async function main() {
  if (!existsSync(BACKUP_FILE)) {
    console.error(`No backup at ${BACKUP_FILE}. Run export-decor.ts first.`);
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP_FILE, 'utf8')) as Backup;
  const { root } = getAdminRoot();
  await removeDecor(root, backup, { confirm: process.argv.includes('--confirm') });
}

if (process.argv[1]?.endsWith('remove-decor.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
