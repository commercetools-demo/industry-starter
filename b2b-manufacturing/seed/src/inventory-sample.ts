import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getAdminRoot, parseArgs, type Root } from './lib';
import { isSeedOwned, type Kind, type Manifest, type ManifestEntry } from './sample-manifest';

/**
 * Lists every resource that is NOT owned by the seed (key prefix `mpw-`) into data/sample-inventory.json. Read-only.
 * Review the file (Claude does it through the Merchant Center MCP), then `cleanup-sample.ts --manifest … --confirm <key>`.
 *
 *   npx tsx src/inventory-sample.ts
 */
type Page<T> = { results: T[]; total?: number; count: number };
interface Row { id: string; version: number; key?: string; name?: unknown; container?: string; ancestors?: unknown[]; parentUnit?: unknown }

async function all(fetchPage: (offset: number) => Promise<Page<Row>>): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(offset);
    out.push(...page.results);
    if (page.results.length < 100) break;
  }
  return out;
}

const label = (n: unknown): string | undefined => (typeof n === 'string' ? n : n && typeof n === 'object' ? (Object.values(n as Record<string, string>)[0] as string | undefined) : undefined);

export async function collect(root: Root): Promise<ManifestEntry[]> {
  const q = (offset: number) => ({ queryArgs: { limit: 100, offset } });
  const sources: [Kind, (o: number) => Promise<Page<Row>>][] = [
    ['orders', async (o) => (await root.orders().get(q(o)).execute()).body as unknown as Page<Row>],
    ['quotes', async (o) => (await root.quotes().get(q(o)).execute()).body as unknown as Page<Row>],
    ['staged-quotes', async (o) => (await root.stagedQuotes().get(q(o)).execute()).body as unknown as Page<Row>],
    ['quote-requests', async (o) => (await root.quoteRequests().get(q(o)).execute()).body as unknown as Page<Row>],
    ['carts', async (o) => (await root.carts().get(q(o)).execute()).body as unknown as Page<Row>],
    ['inventory', async (o) => (await root.inventory().get(q(o)).execute()).body as unknown as Page<Row>],
    ['business-units', async (o) => (await root.businessUnits().get(q(o)).execute()).body as unknown as Page<Row>],
    ['customers', async (o) => (await root.customers().get(q(o)).execute()).body as unknown as Page<Row>],
    ['product-selections', async (o) => (await root.productSelections().get(q(o)).execute()).body as unknown as Page<Row>],
    ['stores', async (o) => (await root.stores().get(q(o)).execute()).body as unknown as Page<Row>],
    ['products', async (o) => (await root.products().get(q(o)).execute()).body as unknown as Page<Row>],
    ['categories', async (o) => (await root.categories().get(q(o)).execute()).body as unknown as Page<Row>],
    ['product-types', async (o) => (await root.productTypes().get(q(o)).execute()).body as unknown as Page<Row>],
    ['shipping-methods', async (o) => (await root.shippingMethods().get(q(o)).execute()).body as unknown as Page<Row>],
    ['tax-categories', async (o) => (await root.taxCategories().get(q(o)).execute()).body as unknown as Page<Row>],
    ['zones', async (o) => (await root.zones().get(q(o)).execute()).body as unknown as Page<Row>],
    ['types', async (o) => (await root.types().get(q(o)).execute()).body as unknown as Page<Row>],
    ['custom-objects', async (o) => (await root.customObjects().get(q(o)).execute()).body as unknown as Page<Row>],
  ];
  const entries: ManifestEntry[] = [];
  for (const [kind, page] of sources) {
    for (const r of await all(page)) {
      if (isSeedOwned(r)) continue;
      entries.push({ kind, id: r.id, version: r.version, key: r.key, name: label(r.name), container: r.container, depth: kind === 'categories' ? (r.ancestors?.length ?? 0) : kind === 'business-units' ? (r.parentUnit ? 1 : 0) : undefined });
    }
  }
  return entries;
}

async function main() {
  parseArgs(process.argv.slice(2));
  const { root, env } = await getAdminRoot();
  const manifest: Manifest = { projectKey: env.projectKey, createdAt: new Date().toISOString(), entries: await collect(root) };
  const file = path.join(DATA_DIR, 'sample-inventory.json');
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  const counts = manifest.entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + 1 }), {});
  console.log(`wrote ${file}\n${JSON.stringify(counts)}\nReview it before running cleanup-sample.ts.`);
}

if (process.argv[1]?.endsWith('inventory-sample.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
