// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Bundle report (workstream Y, D5): first-load JavaScript per route from the production build output, gzip-compressed, against the
// budgets of the plan. Next 16 prints no sizes, so the sizes come from `.next/build-manifest.json` (shared chunks every page loads)
// and the `entryJSFiles` of each `page_client-reference-manifest.js` (the chunks of the page and its layouts). Lazy chunks
// (next/dynamic, for example the Leaflet map) are not first load and are not counted.
// Usage: node scripts/bundle-report.mjs [--json]   (run after `next build`; exits 1 when a budget is exceeded)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
/** Storefront budgets, compressed (plans/workstreams/Y D5): 220 KB on home, listing, search, product and cart; 260 KB on checkout, account and confirmation. */
export const BUDGETS = { shopping: 220 * KB, other: 260 * KB, home: 380 * KB };
/** The home page loads the Puck page renderer with the default and automotive blocks (about 145 KB compressed, a third-party package) when a Contentools home page is published. Documented exception Q-Y01 of storefront Y: 380 KB, only for the home route. */
export const HOME_ROUTE = /^\/\[locale\]\/\[store\]$/;
/** Routes of the first budget (the shopping pages of D5). Everything else gets the second one. */
export const SHOPPING_ROUTES = [/^\/\[locale\]\/\[store\]\/(category|p|search|parts|cart)(\/|$)/];

export const budgetFor = (route) => (HOME_ROUTE.test(route) ? BUDGETS.home : SHOPPING_ROUTES.some((re) => re.test(route)) ? BUDGETS.shopping : BUDGETS.other);

/** `/[locale]/[store]/cart` from `[project]/app/[locale]/[store]/cart/page`; route groups are dropped. */
export function routeOfEntry(key) {
  const m = /^\[project\]\/app(\/.*)\/page$/.exec(key) ?? /^\[project\]\/app()\/page$/.exec(key);
  if (!m) return null;
  return m[1].replace(/\/\([^/)]+\)/g, '') || '/';
}

/** The `__RSC_MANIFEST[...] = {...}` object of a page_client-reference-manifest.js. */
export function parseManifest(text) {
  const start = text.indexOf('= {');
  if (start < 0) return null;
  return JSON.parse(text.slice(start + 2).replace(/;\s*$/, ''));
}

function* manifests(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) yield* manifests(p);
    else if (f === 'page_client-reference-manifest.js') yield p;
  }
}

const sizeCache = new Map();
function gzipSize(root, file) {
  const p = path.join(root, '.next', file);
  if (!sizeCache.has(p)) sizeCache.set(p, existsSync(p) ? gzipSync(readFileSync(p)).length : 0);
  return sizeCache.get(p);
}

/** One row per page route: { route, files, bytes, budget }. */
export function buildReport(root) {
  const appDir = path.join(root, '.next/server/app');
  const manifestPath = path.join(root, '.next/build-manifest.json');
  if (!existsSync(appDir) || !existsSync(manifestPath)) throw new Error('no build output in .next: run `next build` first');
  const build = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const shared = [...(build.polyfillFiles ?? []), ...(build.rootMainFiles ?? [])];
  const rows = [];
  for (const file of manifests(appDir)) {
    const manifest = parseManifest(readFileSync(file, 'utf8'));
    for (const [key, chunks] of Object.entries(manifest?.entryJSFiles ?? {})) {
      const route = routeOfEntry(key);
      // Development-only pages (`/dev/*`) do not exist in a release build (check-no-dev-pages): not measured.
      if (!route || route.startsWith('/dev/')) continue;
      const files = [...new Set([...shared, ...chunks])];
      rows.push({ route, files: files.length, bytes: files.reduce((n, f) => n + gzipSize(root, f), 0), budget: budgetFor(route) });
    }
  }
  if (!rows.length) throw new Error('no page manifests found: the build output format is not the Next 16 one this report reads');
  return rows.sort((a, b) => b.bytes - a.bytes);
}

export const overBudget = (rows) => rows.filter((r) => r.bytes > r.budget);

const kb = (n) => `${(n / KB).toFixed(1)} KB`;

export function formatReport(rows) {
  const lines = ['route'.padEnd(60) + 'files'.padStart(6) + 'gzip'.padStart(12) + 'budget'.padStart(12) + '  status'];
  for (const r of rows) lines.push(r.route.padEnd(60) + String(r.files).padStart(6) + kb(r.bytes).padStart(12) + kb(r.budget).padStart(12) + (r.bytes > r.budget ? '  OVER' : '  ok'));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  try {
    const rows = buildReport(process.cwd());
    console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 1) : formatReport(rows));
    const over = overBudget(rows);
    if (over.length) {
      console.error(`\n${over.length} route(s) over the first-load JavaScript budget: ${over.map((r) => r.route).join(', ')}`);
      process.exit(1);
    }
    console.log(`\nbundle-report: OK (${rows.length} routes within budget)`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
