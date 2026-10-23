// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { writeFileSync } from 'node:fs';
import type { Api, Kind, Res } from './api';
import { PREFIX } from './data/base';
import { DEFAULT_MANIFEST, fail, getAdmin, isMainModule, parseArgs } from './lib';

/**
 * Step one of the sample-data cleanup (D-019, D-020): READ the project and write a reviewable manifest of every
 * resource that is not seed-owned. Nothing is deleted here. A human or the lead reviews `cleanup-manifest.json`,
 * removes entries that must stay, and only then runs `seed:cleanup -- --manifest <file> --confirm <projectKey>`.
 * Resources with the seed prefix `mcf-` are never listed (counted in `skippedSeedOwned` only), built-in states are skipped.
 * Orders and carts are not listed: they cannot be deleted through the API and stay.
 *
 *   npm run seed:inventory [-- --manifest <file>] [-- --dry-run]
 */
export interface ManifestEntry {
  type: Kind;
  /** The key, or the id when the resource has no key. */
  ref: string;
  id: string;
  key?: string;
  name: string;
  version: number;
  /** Category depth (ancestors), so the delete step can go deepest first. */
  depth: number;
}

export interface Manifest {
  projectKey: string;
  createdAt: string;
  counts: Record<string, number>;
  skippedSeedOwned: Record<string, number>;
  entries: ManifestEntry[];
}

/** Kinds inventoried (the spec's list plus inventory entries, which block channel deletion). */
export const INVENTORY_KINDS: Kind[] = [
  'products', 'product-types', 'categories', 'product-discounts', 'cart-discounts', 'discount-codes', 'shipping-methods', 'zones',
  'tax-categories', 'channels', 'types', 'recurrence-policies', 'states', 'shopping-lists', 'customers', 'reviews', 'inventory',
];

type LStr = Record<string, string> | string | undefined;
const lname = (v: LStr): string | undefined => (typeof v === 'string' ? v : v ? (v['en-US'] ?? Object.values(v)[0]) : undefined);

/** A readable name for any kind. */
export function nameOf(kind: Kind, r: Res): string {
  const md = r.masterData as { current?: { name?: LStr }; staged?: { name?: LStr } } | undefined;
  const byKind: Partial<Record<Kind, string | undefined>> = {
    products: lname(md?.staged?.name) ?? lname(md?.current?.name),
    customers: (r.email as string | undefined),
    reviews: (r.title as string | undefined),
    inventory: r.sku ? `${String(r.sku)}${r.supplyChannel ? ' (channel)' : ''}` : undefined,
    'discount-codes': (r.code as string | undefined),
    zones: (r.name as string | undefined),
    'tax-categories': (r.name as string | undefined),
  };
  return byKind[kind] ?? lname(r.name as LStr) ?? r.key ?? r.id;
}

export async function buildManifest(api: Api, projectKey: string, now: Date = new Date()): Promise<Manifest> {
  const entries: ManifestEntry[] = [];
  const counts: Record<string, number> = {};
  const skippedSeedOwned: Record<string, number> = {};
  for (const kind of INVENTORY_KINDS) {
    counts[kind] = 0;
    skippedSeedOwned[kind] = 0;
    for (const r of await api.list(kind)) {
      if (r.key?.startsWith(PREFIX)) { skippedSeedOwned[kind] = (skippedSeedOwned[kind] ?? 0) + 1; continue; }
      if (kind === 'states' && r.builtIn === true) continue;
      counts[kind] = (counts[kind] ?? 0) + 1;
      entries.push({
        type: kind, ref: r.key ?? r.id, id: r.id, ...(r.key ? { key: r.key } : {}), name: nameOf(kind, r), version: r.version,
        depth: kind === 'categories' ? ((r.ancestors as unknown[]) ?? []).length : 0,
      });
    }
  }
  return { projectKey, createdAt: now.toISOString(), counts, skippedSeedOwned, entries };
}

export function formatManifestCounts(m: Manifest): string[] {
  return [
    'type                  to review   seed-owned (not listed)',
    ...Object.keys(m.counts).map((k) => `${k.padEnd(22)}${String(m.counts[k]).padStart(8)}${String(m.skippedSeedOwned[k] ?? 0).padStart(14)}`),
    `total entries: ${m.entries.length}`,
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  const manifest = await buildManifest(api, env.projectKey);
  console.log(formatManifestCounts(manifest).join('\n'));
  if (args.dryRun) {
    console.log('dry run: manifest not written');
    return;
  }
  const file = args.manifest ?? DEFAULT_MANIFEST;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest written to ${file}. Review it, delete entries that must stay, then run seed:cleanup within 24 hours.`);
}

if (isMainModule(import.meta.url)) main().catch(fail);
