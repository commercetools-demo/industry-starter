// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Reads the route table printed by `next build` (saved to .next-build-output.txt).
// Usage: node scripts/check-routes.mjs <build-output.txt> | --static (no build output; nothing to check).
// A release build (RELEASE=1, or NODE_ENV=production with CONTEXT=production) must not contain a /dev route.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isRelease } from './check-no-health-in-release.mjs';

/** Routes from lines such as `┌ ○ /path`, `├ ● /path`, `└ ƒ /path`. */
export function parseRoutes(output) {
  const routes = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^\s*[┌├└│]\s*([○●ƒλ◐])\s+(\/\S*)/u);
    if (m) routes.push({ kind: m[1], route: m[2] });
  }
  return routes;
}

export function checkRoutes(output, env = process.env) {
  if (!isRelease(env)) return [];
  return parseRoutes(output)
    .filter(({ route }) => route === '/dev' || route.startsWith('/dev/'))
    .map(({ route }) => `route ${route} must not be in a release build`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  if (!arg || arg === '--static') {
    console.log('check-routes: static mode, nothing to check');
  } else {
    if (!existsSync(arg)) {
      console.error(`${arg} not found; run npm run verify:build`);
      process.exit(1);
    }
    const problems = checkRoutes(readFileSync(arg, 'utf8'));
    if (problems.length) {
      console.error(problems.join('\n'));
      process.exit(1);
    }
    console.log('check-routes: OK');
  }
}
