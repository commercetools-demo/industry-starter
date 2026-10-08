import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveModule(spec: string, from: string): string | null {
  const base = spec.startsWith('@/') ? resolve(root, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(tsx?)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every site-local source file reachable from `entry` through static imports (the entry included). */
export function localImportGraph(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2] ?? match[3];
      const target = spec ? resolveModule(spec, file) : null;
      if (target) visit(target);
    }
  };
  visit(entry);
  return [...seen].map((file) => file.slice(root.length + 1));
}
