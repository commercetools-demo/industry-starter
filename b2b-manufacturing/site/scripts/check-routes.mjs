// Fails when a public route is dynamic in the `next build` output. Usage: node scripts/check-routes.mjs [build-output.txt]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PUBLIC = [/^\/\[locale\]$/, /^\/\[locale\]\/plumbing$/, /^\/\[locale\]\/waste-management$/, /^\/\[locale\]\/about$/, /^\/\[locale\]\/privacy$/, /^\/\[locale\]\/(plumbing|waste-management)\/\[slug\]$/, /^\/en-US$/, /^\/de-DE$/];

/** Reads the route table printed by `next build`: `┌ ○ /path`, `├ ● /path`, `└ ƒ /path`. */
export function dynamicPublicRoutes(output) {
  const bad = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^[┌├└│]\s*([○●ƒλ◐])\s+(\/\S*)/u);
    if (!m) continue;
    if (['ƒ', 'λ'].includes(m[1]) && PUBLIC.some((re) => re.test(m[2]))) bad.push(m[2]);
  }
  return bad;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const file = process.argv[2] ?? '.next/build-output.txt';
  const bad = dynamicPublicRoutes(readFileSync(file, 'utf8'));
  if (bad.length) { console.error(`Public routes must be static or revalidated, but these are dynamic:\n  ${bad.join('\n  ')}\n(Does a layout or page read cookies(), headers() or the session?)`); process.exit(1); }
  console.log('check-routes: ok');
}
