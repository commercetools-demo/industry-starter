// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Route policy completeness (workstream X-01, decision D6): every Route Handler under app/api/** has a line in
// lib/authz/route-policy.ts with an access for each method it exports, and every line has a route file. Run by
// `check-routes.mjs --static` (so by `npm run check`). Identical copy in storefront/ and portal/.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listRoutes } from './list-routes.mjs';

const METHOD = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g;

/** `{ pattern -> Set(methods) }` from the `p('/api/x', { GET: ..., POST: ... })` lines of the policy file. */
export function parsePolicy(source) {
  const policy = new Map();
  for (const m of source.matchAll(/\bp\(\s*'([^']+)'\s*,\s*\{([^}]*)\}/g)) {
    policy.set(m[1], new Set([...m[2].matchAll(METHOD)].map((x) => x[1])));
  }
  return policy;
}

export function checkRoutePolicy(root) {
  if (!existsSync(path.join(root, 'app', 'api'))) return [];
  const file = path.join(root, 'lib', 'authz', 'route-policy.ts');
  if (!existsSync(file)) return ['lib/authz/route-policy.ts is missing: every Route Handler needs a policy line (workstream X-01)'];
  const policy = parsePolicy(readFileSync(file, 'utf8'));
  const routes = listRoutes(root);
  const problems = [];
  for (const route of routes) {
    const methods = policy.get(route.pattern);
    if (!methods) {
      problems.push(`${route.file} has no line in lib/authz/route-policy.ts (add p('${route.pattern}', { ... }))`);
      continue;
    }
    for (const method of route.methods) if (!methods.has(method)) problems.push(`${route.file} exports ${method} but the policy line of ${route.pattern} gives it no access`);
    for (const method of methods) if (!route.methods.includes(method)) problems.push(`policy line ${route.pattern} lists ${method} but ${route.file} does not export it`);
  }
  const known = new Set(routes.map((r) => r.pattern));
  for (const pattern of policy.keys()) if (!known.has(pattern)) problems.push(`policy line ${pattern} has no route file under app/api`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const problems = checkRoutePolicy(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('route policy: OK');
}
