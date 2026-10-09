import { getAdminRoot, hasPrefix, isMain, listAll, PREFIX, type Kind, type Root } from './lib';

/**
 * Prints how many resources of every kind the project holds (and how many carry the seed prefix). Read-only.
 *
 *   npx tsx scripts/seed/inventory-project.ts
 */
const KINDS: Kind[] = ['products', 'productTypes', 'categories', 'inventory', 'carts', 'orders', 'customers', 'shippingMethods', 'zones', 'taxCategories', 'stores', 'states', 'types', 'channels'];

export interface KindCount { kind: string; total: number; prefixed: number }

export async function countProject(root: Root): Promise<KindCount[]> {
  const out: KindCount[] = [];
  for (const kind of KINDS) {
    const list = await listAll(root, kind);
    out.push({ kind, total: list.length, prefixed: list.filter(hasPrefix).length });
  }
  return out;
}

export function formatCounts(counts: KindCount[]): string {
  return [`| kind | total | key starts with ${PREFIX} |`, '| --- | --- | --- |', ...counts.map((c) => `| ${c.kind} | ${c.total} | ${c.prefixed} |`)].join('\n');
}

async function main() {
  const { root, projectKey } = await getAdminRoot();
  console.log(`project ${projectKey}\n${formatCounts(await countProject(root))}`);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
