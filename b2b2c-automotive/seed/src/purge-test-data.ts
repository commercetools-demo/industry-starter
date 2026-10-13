// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Api, Kind, Res } from './api';
import { fail, getAdmin, isMainModule, parseArgs, PREFIX, Runner, SEED_DIR, sleep } from './lib';

/**
 * Deletes the TEST DATA that journeys, attack runs and browser sweeps left in the project (workstream Z-07). It never
 * lists a kind and deletes "what looks like test data": it reads the registers `plans/evidence/<letter>/test-data.md`
 * (record type and id), and for each registered record it re-reads the record and deletes it only when
 *   - the record exists,
 *   - its key, order number, PO number, customer number, code, external id, title, SKU or a name carries the `TST-` prefix
 *     (customers: an e-mail `tst-...@example.com`), and
 *   - it does NOT carry the seed prefix `mau-` (the seed's own data is `npm run reset`, never this script).
 * Ids that are not in a register are never touched. Dry run is the default.
 *
 * Register format (any markdown table row inside a `test-data.md`; other lines are ignored):
 *   | <kind> | <id> | <note> |
 * with `<kind>` one of the PURGE_ORDER kinds below, `<id>` the commercetools id. Rows of other kinds (recurring
 * orders, payments, custom objects) are listed as "manual" in the plan: the platform or the admin client has no
 * safe generic delete for them here, so the owner removes them in the Merchant Center.
 *
 *   npm run purge:test-data                                        dry run, prints the plan
 *   npm run purge:test-data -- --apply --confirm spec-test-b2b2c-automotive
 */
export const PURGE_ORDER: Kind[] = [
  'reviews', 'orders', 'carts', 'discount-codes', 'cart-discounts', 'product-discounts', 'standalone-prices', 'inventory', 'customers', 'business-units',
];
export const TEST_PREFIX = 'TST-';

export interface Registered { kind: Kind; id: string; source: string }
export interface Manual { kind: string; id: string; source: string }

/** Reads `test-data.md` registers under `<root>/plans/evidence/*`. */
export function readRegisters(evidenceDir: string): { records: Registered[]; manual: Manual[]; files: string[] } {
  const records: Registered[] = [];
  const manual: Manual[] = [];
  const files: string[] = [];
  if (!existsSync(evidenceDir)) return { records, manual, files };
  for (const d of readdirSync(evidenceDir, { withFileTypes: true })) {
    const f = path.join(evidenceDir, d.name, 'test-data.md');
    if (!d.isDirectory() || !existsSync(f)) continue;
    files.push(path.relative(evidenceDir, f));
    const parsed = parseRegister(readFileSync(f, 'utf8'), `${d.name}/test-data.md`);
    records.push(...parsed.records);
    manual.push(...parsed.manual);
  }
  return { records, manual, files };
}

export function parseRegister(text: string, source: string): { records: Registered[]; manual: Manual[] } {
  const records: Registered[] = [];
  const manual: Manual[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ''));
    const [kind, id] = cells;
    if (!kind || !id || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,}$/.test(id) || !/^[a-z][a-z-]+$/.test(kind)) continue;
    if ((PURGE_ORDER as string[]).includes(kind)) records.push({ kind: kind as Kind, id, source });
    else if (/^(recurring-orders|payments|custom-objects|subscriptions|carts-in-store|returns)$/.test(kind)) manual.push({ kind, id, source });
  }
  return { records, manual };
}

const text = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v as Record<string, unknown>).filter((x): x is string => typeof x === 'string') : []);

/** True when the record carries the test marker in a key, number, code, name or similar field. */
export function carriesTestMarker(res: Res): boolean {
  const fields = ['key', 'orderNumber', 'purchaseOrderNumber', 'customerNumber', 'code', 'externalId', 'title', 'sku', 'name', 'authorName'];
  if (fields.some((f) => text(res[f]).some((v) => v.startsWith(TEST_PREFIX)))) return true;
  const email = typeof res.email === 'string' ? res.email.toLowerCase() : '';
  return email.startsWith('tst-') && email.endsWith('@example.com');
}

export const isSeedData = (res: Res): boolean => [res.key, res.sku].some((v) => typeof v === 'string' && v.startsWith(PREFIX));

export interface PurgeEntry { kind: Kind; res: Res; source: string }
export interface PurgePlan { entries: PurgeEntry[]; skipped: string[]; manual: Manual[] }

export async function planPurge(api: Api, records: Registered[], manual: Manual[] = []): Promise<PurgePlan> {
  const entries: PurgeEntry[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(`${r.kind}/${r.id}`)) continue;
    seen.add(`${r.kind}/${r.id}`);
    const res = await api.getById(r.kind, r.id);
    if (!res) { skipped.push(`${r.kind} ${r.id}: not found (already gone)`); continue; }
    if (isSeedData(res)) { skipped.push(`${r.kind} ${r.id}: carries the seed prefix ${PREFIX}, never purged here`); continue; }
    if (!carriesTestMarker(res)) { skipped.push(`${r.kind} ${r.id}: no ${TEST_PREFIX} marker, left in place`); continue; }
    entries.push({ kind: r.kind, res, source: r.source });
  }
  entries.sort((a, b) => PURGE_ORDER.indexOf(a.kind) - PURGE_ORDER.indexOf(b.kind));
  return { entries, skipped, manual };
}

export function formatPlan(plan: PurgePlan, dryRun: boolean): string[] {
  return [
    `${dryRun ? 'DRY RUN (nothing is deleted)' : 'APPLY'}: ${plan.entries.length} to delete, ${plan.skipped.length} skipped, ${plan.manual.length} manual`,
    ...plan.entries.map((e) => `  delete ${e.kind} ${e.res.id} ${String(e.res.key ?? e.res.orderNumber ?? e.res.code ?? '')} (register ${e.source})`),
    ...plan.skipped.map((s) => `  skip   ${s}`),
    ...plan.manual.map((m) => `  manual ${m.kind} ${m.id} (register ${m.source}): remove it in the Merchant Center`),
  ];
}

export async function executePurge(api: Api, run: Runner, plan: PurgePlan, pause: () => Promise<void> = () => Promise.resolve()): Promise<number> {
  let failed = 0;
  for (const e of plan.entries) {
    try {
      await run.act(`delete ${e.kind} ${e.res.id}`, async () => {
        const fresh = await api.getById(e.kind, e.res.id); // current version
        if (fresh) await api.remove(e.kind, { id: fresh.id, version: fresh.version });
      });
      await pause();
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${e.kind} ${e.res.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const apply = argv.includes('--apply');
  const { api, env } = await getAdmin();
  if (apply && args.confirm !== env.projectKey) throw new Error(`--apply needs --confirm ${env.projectKey}`);
  const { records, manual, files } = readRegisters(path.resolve(SEED_DIR, '..', 'plans', 'evidence'));
  console.log(`registers read: ${files.join(', ') || '(none)'}`);
  const plan = await planPurge(api, records, manual);
  console.log(formatPlan(plan, !apply).join('\n'));
  const run = new Runner(!apply);
  const failed = await executePurge(api, run, plan, () => sleep(80));
  console.log(`${apply ? '' : 'dry run: '}${run.changes} deletion(s), ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
