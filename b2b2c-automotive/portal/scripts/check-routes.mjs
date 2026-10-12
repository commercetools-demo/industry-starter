// Route gate. A version: no route beginning with /dev may appear in the build output (R adds the navigation allow-list).
// Usage: node scripts/check-routes.mjs <build-output.txt>   or   node scripts/check-routes.mjs --static
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { walk } from './fs-utils.mjs';

/** Routes listed in the table `next build` prints (`┌ ○ /path`, `├ ● /path`, `└ ƒ /path`). */
export function parseRoutes(output) {
  const routes = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^\s*[┌├└│]\s*([○●ƒλ◐])\s+(\/\S*)/u);
    if (m) routes.push({ kind: m[1], route: m[2] });
  }
  return routes;
}

export function checkRoutes(output) {
  return parseRoutes(output)
    .filter(({ route }) => /^\/dev(\/|$)/.test(route))
    .map(({ route }) => `route ${route} must not be part of a build (dev routes are excluded from production)`);
}

/** Hrefs of `item('id', '/route', ...)` calls and the ROUTE_ALLOW_LIST literal of lib/portal/nav.ts. */
export function navHrefs(source) {
  const hrefs = [...source.matchAll(/\bitem\(\s*'[^']+'\s*,\s*'(\/[^']*)'/g)].map((m) => m[1]);
  const list = /ROUTE_ALLOW_LIST[^=]*=\s*\[([\s\S]*?)\]\s*;/.exec(source)?.[1] ?? '';
  const allow = [...list.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
  return { hrefs, allow };
}

/** Routes of the `(portal)` and `(auth)` groups: the page.tsx files below app/[locale]/, group folders removed. */
function pageRoutes(root) {
  const base = path.join(root, 'app', '[locale]');
  return walk(base)
    .map((f) => path.relative(base, f).split(path.sep).join('/'))
    .filter((rel) => /(^|\/)page\.[tj]sx?$/.test(rel) && /^\((portal|auth)\)\//.test(rel))
    .map((rel) => '/' + rel.replace(/^\((portal|auth)\)\//, '').replace(/(^|\/)page\.[tj]sx?$/, ''))
    .map((route) => (route === '/' ? '/' : route.replace(/\/$/, '')));
}

/**
 * Spec "Route map matches navigation": every nav item has a page, every portal or auth page is a nav item or on the
 * allow-list, and every seller Route Handler has a sibling route.cross-store.test.ts (bootstrap "New seller endpoint
 * without ownership test").
 */
export function checkNavRoutes(root) {
  const navFile = path.join(root, 'lib', 'portal', 'nav.ts');
  if (!existsSync(navFile)) return [];
  const { hrefs, allow } = navHrefs(readFileSync(navFile, 'utf8'));
  const routes = new Set(pageRoutes(root));
  const problems = [];
  for (const href of hrefs) if (!routes.has(href)) problems.push(`nav item ${href} has no page under app/[locale]/(portal)`);
  for (const route of routes) {
    if (!hrefs.includes(route) && !allow.includes(route)) problems.push(`page ${route} is not in the navigation or the allow-list (lib/portal/nav.ts ROUTE_ALLOW_LIST)`);
  }
  const seller = path.join(root, 'app', 'api', 'seller');
  for (const f of walk(seller).filter((p) => /[\\/]route\.ts$/.test(p))) {
    const test = f.replace(/route\.ts$/, 'route.cross-store.test.ts');
    if (!existsSync(test)) problems.push(`${path.relative(root, f).split(path.sep).join('/')} has no route.cross-store.test.ts (seller endpoint without ownership test)`);
  }
  return problems;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = process.argv[2];
  const problems = arg === '--static' || !arg ? [...checkNoDevPages(process.cwd()), ...checkNavRoutes(process.cwd())] : checkRoutes(readFileSync(arg, 'utf8'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('routes: OK');
}
