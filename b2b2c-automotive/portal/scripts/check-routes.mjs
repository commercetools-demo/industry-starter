// Route gate. A version: no route beginning with /dev may appear in the build output (R adds the navigation allow-list).
// Usage: node scripts/check-routes.mjs <build-output.txt>   or   node scripts/check-routes.mjs --static
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkNoDevPages } from './check-no-dev-pages.mjs';

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

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = process.argv[2];
  const problems = arg === '--static' || !arg ? checkNoDevPages(process.cwd()) : checkRoutes(readFileSync(arg, 'utf8'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('routes: OK');
}
