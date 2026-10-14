// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Lists every Route Handler under app/api/** with its URL pattern and exported HTTP methods (workstream X-01).
// Usage: node scripts/list-routes.mjs [--json]      (the markdown table is the route inventory in plans/evidence/X/)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP = new Set(['node_modules', '.next', '.git', 'coverage']);
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        if (SKIP.has(f)) return [];
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** `app/api/seller/orders/[number]/route.ts` -> `/api/seller/orders/[number]`; catch-all folders keep their `[...x]` name. */
export function patternOf(relativeFile) {
  const dir = relativeFile.replace(/\\/g, '/').replace(/\/route\.[tj]s$/, '');
  return '/' + dir.replace(/^app\//, '');
}

/** Exported method names of a route file (`export const GET`, `export async function POST`, `export { x as PUT }`). */
export function methodsOf(source) {
  const found = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:const|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) found.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (HTTP_METHODS.includes(name)) found.add(name);
    }
  }
  return HTTP_METHODS.filter((x) => found.has(x));
}

export function listRoutes(root) {
  const base = path.join(root, 'app', 'api');
  return walk(base)
    .filter((f) => /[\\/]route\.[tj]s$/.test(f))
    .map((file) => {
      const rel = path.relative(root, file).split(path.sep).join('/');
      return { pattern: patternOf(rel), file: rel, methods: methodsOf(readFileSync(file, 'utf8')) };
    })
    .sort((a, b) => a.pattern.localeCompare(b.pattern));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const routes = listRoutes(process.cwd());
  if (process.argv.includes('--json')) console.log(JSON.stringify(routes, null, 2));
  else {
    console.log('| Route | Methods | File |\n| --- | --- | --- |');
    for (const r of routes) console.log(`| \`${r.pattern}\` | ${r.methods.join(', ')} | \`${r.file}\` |`);
  }
  if (!existsSync(path.join(process.cwd(), 'app', 'api'))) process.exit(1);
}
