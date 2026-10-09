// The dev-only health route must answer 404 in production and must not be reachable by a release build.
import { readFileSync } from 'node:fs';
const src = readFileSync('app/api/health/route.ts', 'utf8');
if (!/NODE_ENV === 'production'\) return new NextResponse\(null, \{ status: 404 \}\)/.test(src)) {
  console.error('app/api/health/route.ts must return 404 when NODE_ENV is production');
  process.exit(1);
}
console.log('check-no-health-in-release: ok');
