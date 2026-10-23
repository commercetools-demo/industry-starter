// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import type { Api, Kind } from './api';
import { PREFIX } from './data/base';
import type { Manifest, ManifestEntry } from './inventory';
import { DEFAULT_MANIFEST, fail, isMainModule, loadEnv, connect, parseArgs, Runner, sleep } from './lib';

/**
 * Step two of the sample-data cleanup: deletes ONLY the entries of a reviewed manifest (`seed:inventory`), in
 * dependency order. There is no wildcard and no "delete everything not mine".
 *
 * Refuses, before any request: a `--confirm` that is not the project key, a manifest for another project, a manifest older
 * than 24 hours. Refuses (and reports) every entry whose key starts with `mcf-`. Orders and carts are never touched.
 *
 *   npm run seed:cleanup -- --manifest cleanup-manifest.json --dry-run
 *   npm run seed:cleanup -- --manifest cleanup-manifest.json --confirm <projectKey>
 */
export const MAX_MANIFEST_AGE_MS = 24 * 60 * 60 * 1000;

/** Dependants before what they reference: reviews and lists before customers and products, categories deepest first, types and states last. */
export const DELETE_ORDER: Kind[] = [
  'reviews', 'shopping-lists', 'customers', 'discount-codes', 'cart-discounts', 'product-discounts', 'inventory', 'products',
  'shipping-methods', 'tax-categories', 'zones', 'categories', 'product-types', 'recurrence-policies', 'channels', 'types', 'states',
];

export interface Plan { entries: ManifestEntry[]; refused: string[] }

export const isSeedOwned = (key: string | undefined): boolean => !!key && key.startsWith(PREFIX);

export function loadManifest(file: string): Manifest {
  const m = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
  if (!m || !Array.isArray(m.entries) || typeof m.createdAt !== 'string' || typeof m.projectKey !== 'string') throw new Error(`${file} is not a cleanup manifest (run npm run seed:inventory)`);
  return m;
}

/** Checks that must pass before the first request. */
export function assertCleanupAllowed(o: { manifest: Manifest; projectKey: string; confirm?: string; dryRun: boolean; now?: Date }): void {
  if (!o.dryRun && o.confirm !== o.projectKey) throw new Error(`--confirm must equal the project key "${o.projectKey}" (or use --dry-run)`);
  if (o.manifest.projectKey !== o.projectKey) throw new Error(`The manifest was written for project "${o.manifest.projectKey}", not "${o.projectKey}"`);
  const age = (o.now ?? new Date()).getTime() - new Date(o.manifest.createdAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > MAX_MANIFEST_AGE_MS) throw new Error(`The manifest is older than 24 hours (created ${o.manifest.createdAt}). Run npm run seed:inventory again and review it.`);
}

/** Splits a manifest into what may be deleted (in order) and what is refused (seed-owned keys). */
export function planCleanup(manifest: Manifest): Plan {
  const refused: string[] = [];
  const entries: ManifestEntry[] = [];
  for (const e of manifest.entries) {
    if (!DELETE_ORDER.includes(e.type)) { refused.push(`${e.type} ${e.ref}: type is not supported by cleanup`); continue; }
    if (isSeedOwned(e.key) || isSeedOwned(e.ref)) { refused.push(`${e.type} ${e.ref}: key has the seed prefix ${PREFIX}`); continue; }
    entries.push(e);
  }
  entries.sort((a, b) => DELETE_ORDER.indexOf(a.type) - DELETE_ORDER.indexOf(b.type) || b.depth - a.depth);
  return { entries, refused };
}

export function formatPlan(plan: Plan): string[] {
  const counts = new Map<string, number>();
  for (const e of plan.entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [
    'type                  to delete',
    ...DELETE_ORDER.map((k) => `${k.padEnd(22)}${String(counts.get(k) ?? 0).padStart(6)}`),
    ...plan.refused.map((r) => `REFUSED ${r}`),
  ];
}

export interface Target { kind: Kind; id: string; label: string }

/** Deletes one resource by its CURRENT version; a published product is unpublished first. Missing resources are skipped. */
async function removeOne(api: Api, t: Target): Promise<void> {
  const current = await api.getById(t.kind, t.id);
  if (!current) return;
  let version = current.version;
  if (t.kind === 'products' && (current.masterData as { published?: boolean } | undefined)?.published) version = (await api.update('products', current, [{ action: 'unpublish' }])).version;
  await api.remove(t.kind, { id: current.id, version });
}

/**
 * Deletes the targets in the given order. A target that fails (for example because something still references it) is
 * retried after the others, up to 3 passes, so transition chains between states resolve. Returns the failures.
 */
export async function deleteTargets(api: Api, run: Runner, targets: Target[], pause: () => Promise<void> = () => Promise.resolve()): Promise<string[]> {
  let pending = targets;
  let errors: Map<string, string> = new Map();
  for (let pass = 1; pass <= 3 && pending.length > 0; pass += 1) {
    const failed: Target[] = [];
    errors = new Map();
    for (const t of pending) {
      try {
        await run.act(`delete ${t.label}`, () => removeOne(api, t));
        await pause();
      } catch (err) {
        failed.push(t);
        errors.set(t.label, err instanceof Error ? err.message : String(err));
        run.changes -= 1; // a failed attempt is not a deletion
      }
    }
    if (failed.length === pending.length) break; // no progress
    pending = failed;
  }
  return pending.map((t) => `${t.label}: ${errors.get(t.label) ?? 'failed'}`);
}

export interface CleanupOptions {
  api: Api;
  run: Runner;
  manifest: Manifest;
  projectKey: string;
  confirm?: string;
  now?: Date;
  pause?: () => Promise<void>;
}

/** Validates everything first (no request on failure), then deletes. Returns the number of failures and refusals. */
export async function runCleanup(o: CleanupOptions): Promise<{ deleted: number; failed: string[]; refused: string[] }> {
  assertCleanupAllowed({ manifest: o.manifest, projectKey: o.projectKey, confirm: o.confirm, dryRun: o.run.dryRun, now: o.now });
  const plan = planCleanup(o.manifest);
  o.run.note(formatPlan(plan).join('\n'));
  const before = o.run.changes;
  const failed = await deleteTargets(o.api, o.run, plan.entries.map((e) => ({ kind: e.type, id: e.id, label: `${e.type} ${e.ref}` })), o.pause);
  return { deleted: o.run.changes - before, failed, refused: plan.refused };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { env } = loadEnv(); // first guard, no network
  const manifest = loadManifest(args.manifest ?? DEFAULT_MANIFEST);
  // Everything that can be refused is refused here, before the first request.
  assertCleanupAllowed({ manifest, projectKey: env.projectKey, confirm: args.confirm, dryRun: args.dryRun });
  const api = await connect(env);
  const run = new Runner(args.dryRun);
  const r = await runCleanup({ api, run, manifest, projectKey: env.projectKey, confirm: args.confirm, pause: () => sleep(80) });
  for (const f of r.failed) console.error(`FAILED ${f}`);
  console.log(`${args.dryRun ? 'dry run: ' : ''}${run.changes} deletion(s), ${r.failed.length} failed, ${r.refused.length} refused`);
  if (r.failed.length > 0 || r.refused.length > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
