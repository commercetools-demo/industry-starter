// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const SCANNED = ['app', 'components', 'hooks', 'context', 'i18n', 'lib'];
const ALLOWED = ['lib/ct/', 'lib/mappers/'];
const IGNORED = new Set(['node_modules', '.next']);

function collect(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(path.join(root, dir))) {
    if (IGNORED.has(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(path.join(root, rel)).isDirectory()) collect(rel, out);
    else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry)) out.push(rel);
  }
  return out;
}

// scripts/** and the two ct-owning folders may use the SDK; nothing else does (types come from @/lib/types).
// The hosted Checkout's browser SDK (`@commercetools/checkout-browser-sdk`, workstream U) is a client widget, not the API SDK: allowed in components.
describe('no SDK leak', () => {
  it('no file outside lib/ct, lib/mappers and scripts imports @commercetools/*', () => {
    const files = SCANNED.filter((dir) => existsSync(path.join(root, dir))).flatMap((dir) => collect(dir, []));
    const offenders = files
      .filter((file) => !ALLOWED.some((prefix) => file.startsWith(prefix)))
      .filter((file) => /from\s+['"]@commercetools\/(?!checkout-browser-sdk)|import\(\s*['"]@commercetools\/(?!checkout-browser-sdk)|require\(\s*['"]@commercetools\/(?!checkout-browser-sdk)/.test(readFileSync(path.join(root, file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
