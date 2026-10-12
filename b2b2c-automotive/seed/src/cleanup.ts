// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import { PREFIX } from './lib';
import { SAMPLE_ALLOWLIST } from './data/sample-allowlist';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';

/**
 * Deletes ONLY the project's known sample data. It lists each resource kind and keeps exactly those whose key is in
 * the explicit allow-list of `src/data/sample-allowlist.ts` (standalone prices: whose SKU is in it). There is no
 * wildcard and no "delete everything not mine": anything not listed is left alone, and anything with the seed prefix
 * `mau-` is refused even if it were listed. Needs EXPECTED_PROJECT_KEY to match (checked by getAdmin) and
 * `--confirm <projectKey>` for a real run.
 *
 *   npm run seed:cleanup -- --dry-run
 *   npm run seed:cleanup -- --confirm spec-test-b2b2c-automotive
 */
type Allow = Record<string, readonly string[]>;

export interface Entry { kind: Kind; res: Res; label: string; depth: number }
export interface Plan { entries: Entry[]; counts: { kind: string; listed: number; matched: number; left: number }[]; refused: string[] }

/** Deletion order: dependants before what they reference; categories deepest first. */
export const DELETE_ORDER: Kind[] = [
  'standalone-prices', 'products', 'product-discounts', 'cart-discounts', 'shipping-methods', 'tax-categories', 'zones',
  'categories', 'product-types', 'recurrence-policies', 'channels',
];

export const isSeedOwned = (key: string | undefined): boolean => !!key && key.startsWith(PREFIX);

const KIND_ALLOW: Record<string, string> = {
  products: 'products', categories: 'categories', 'product-types': 'product-types', 'shipping-methods': 'shipping-methods',
  'tax-categories': 'tax-categories', zones: 'zones', channels: 'channels', 'product-discounts': 'product-discounts',
  'cart-discounts': 'cart-discounts', 'recurrence-policies': 'recurrence-policies',
};

export async function planCleanup(api: Api, allow: Allow = SAMPLE_ALLOWLIST): Promise<Plan> {
  const entries: Entry[] = [];
  const counts: Plan['counts'] = [];
  const refused: string[] = [];
  for (const kind of DELETE_ORDER) {
    const listed = await api.list(kind);
    const keys = new Set(kind === 'standalone-prices' ? [] : (allow[KIND_ALLOW[kind] as string] ?? []));
    const skus = new Set(kind === 'standalone-prices' ? (allow['standalone-price-skus'] ?? []) : []);
    let matched = 0;
    for (const res of listed) {
      const hit = kind === 'standalone-prices' ? skus.has(res.sku as string) : !!res.key && keys.has(res.key);
      if (!hit) continue;
      if (isSeedOwned(res.key) || isSeedOwned(res.sku as string | undefined)) {
        refused.push(`${kind} ${res.key ?? res.id}: key has the seed prefix ${PREFIX}`);
        continue;
      }
      matched += 1;
      entries.push({ kind, res, label: `${kind} ${res.key ?? res.id}`, depth: kind === 'categories' ? ((res.ancestors as unknown[]) ?? []).length : 0 });
    }
    counts.push({ kind, listed: listed.length, matched, left: listed.length - matched });
  }
  const order = (e: Entry) => DELETE_ORDER.indexOf(e.kind);
  entries.sort((a, b) => order(a) - order(b) || b.depth - a.depth);
  return { entries, counts, refused };
}

export function formatCounts(plan: Plan): string[] {
  return [
    'kind                 listed  to delete  left in place',
    ...plan.counts.map((c) => `${c.kind.padEnd(20)} ${String(c.listed).padStart(6)} ${String(c.matched).padStart(10)} ${String(c.left).padStart(14)}`),
    ...plan.refused.map((r) => `REFUSED ${r}`),
  ];
}

async function remove(api: Api, e: Entry): Promise<void> {
  if (e.kind === 'products') {
    // A published product must be unpublished before it can be deleted.
    const p = await api.getById('products', e.res.id);
    if (!p) return;
    let version = p.version;
    if ((p.masterData as { published: boolean }).published) version = (await api.update('products', p, [{ action: 'unpublish' }])).version;
    await api.remove('products', { id: p.id, version });
    return;
  }
  await api.remove(e.kind, e.res);
}

export async function executeCleanup(api: Api, run: Runner, plan: Plan, pause: () => Promise<void> = () => Promise.resolve()): Promise<number> {
  let failed = 0;
  for (const e of plan.entries) {
    try {
      await run.act(`delete ${e.label}`, () => remove(api, e));
      await pause();
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${e.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  if (!args.dryRun && args.confirm !== env.projectKey) throw new Error(`--confirm must equal the project key "${env.projectKey}" (or use --dry-run)`);
  const plan = await planCleanup(api);
  console.log(formatCounts(plan).join('\n'));
  const run = new Runner(args.dryRun);
  const failed = await executeCleanup(api, run, plan, () => sleep(80));
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${failed} failed`);
  if (failed > 0 || plan.refused.length > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
