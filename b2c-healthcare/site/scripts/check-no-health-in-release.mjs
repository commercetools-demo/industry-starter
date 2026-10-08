// Guards the development-only GET /api/health (storefront-bff-and-session: Connection health check).
//  1. If the route file exists it must carry the production 404 guard.
//  2. On a release build (NODE_ENV=production) the file must not exist at all; the release pipeline
//     removes app/api/health/ before `next build`.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HEALTH_ROUTE = 'app/api/health/route.ts';

export function checkNoHealthInRelease(root, env = process.env) {
  const problems = [];
  const file = resolve(root, HEALTH_ROUTE);
  if (!existsSync(file)) return problems;
  if (env.NODE_ENV === 'production') {
    problems.push(`${HEALTH_ROUTE} exists in a production build; remove app/api/health/ before building a release.`);
  }
  const src = readFileSync(file, 'utf8');
  if (!/process\.env\.NODE_ENV\s*===\s*['"]production['"]/.test(src) || !/404/.test(src)) {
    problems.push(`${HEALTH_ROUTE} must answer 404 when NODE_ENV is production.`);
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const problems = checkNoHealthInRelease(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`health check guard: ${problem}`);
    process.exit(1);
  }
  console.log('health check guard: ok');
}
