// Dev-only pages must be unreachable in production: every file under a `dev/` route guards on NODE_ENV.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);

export function checkNoDevPages(root) {
  return walk(path.join(root, 'app'))
    .filter((f) => /(^|[\\/])dev[\\/].*(page|route)\.(tsx?|jsx?)$/.test(path.relative(path.join(root, 'app'), f)) && !/\.test\./.test(f))
    .filter((f) => !/process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*(notFound\(\)|return\s+(new\s+Response|null))/.test(readFileSync(f, 'utf8')))
    .map((f) => `${path.relative(root, f)}: a dev page must call notFound() when NODE_ENV is production`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkNoDevPages(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('dev pages: OK');
}
