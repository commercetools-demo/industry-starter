// Server-only modules guarded at build time (malva-project-bootstrap › Server-only modules guarded at build time).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const isTest = (f) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);

export function checkServerOnly(root) {
  const files = [...walk(path.join(root, 'lib', 'ct')), ...readdirSync(path.join(root, 'lib')).filter((f) => /^session.*\.ts$/.test(f)).map((f) => path.join(root, 'lib', f))].filter((f) => /\.tsx?$/.test(f) && !isTest(f));
  return files.filter((f) => !/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*import\s+['"]server-only['"];?/.test(readFileSync(f, 'utf8'))).map((f) => `${path.relative(root, f)} must start with import 'server-only'`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkServerOnly(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('server-only: OK');
}
