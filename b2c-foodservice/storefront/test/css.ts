import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function readCss(file: string): string {
  return readFileSync(join(process.cwd(), file), 'utf8');
}

/** Custom properties declared in `:root { ... }` as name -> value. */
export function rootTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!block) return out;
  for (const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Custom properties declared inside `@theme inline { ... }`. */
export function themeTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const block = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!block) return out;
  for (const m of block[1].matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Body of the first rule or at-rule whose header matches `header` (balanced braces). */
export function ruleBody(css: string, header: RegExp): string | null {
  const m = header.exec(css);
  if (!m) return null;
  const start = css.indexOf('{', m.index + m[0].length - 1);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  return null;
}

/** Non-test .ts/.tsx files below `dir` (relative to cwd). */
export function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(join(process.cwd(), d))) {
      const rel = `${d}/${name}`;
      if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(rel);
    }
  };
  walk(dir);
  return out;
}
