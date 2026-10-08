// Generates the token allow-list of site/.oxlintrc.json ("x-omelette".tokens) from the
// custom properties of app/tokens.css (design tokens + storefront extensions), so it never drifts.
//   node scripts/gen-lint-allowlist.mjs           rewrite .oxlintrc.json
//   node scripts/gen-lint-allowlist.mjs --check   fail if .oxlintrc.json is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTokens } from './check-token-parity.mjs';

/** Sorted allow-list of every custom property declared in `tokensCss`. */
export function tokenAllowlist(tokensCss) {
  return [...parseTokens(tokensCss).keys()].sort();
}

/** Returns the .oxlintrc.json text with the allow-list inserted. */
export function withAllowlist(rcText, tokensCss) {
  const rc = JSON.parse(rcText);
  rc['x-omelette'] = { ...rc['x-omelette'], tokens: tokenAllowlist(tokensCss) };
  return `${JSON.stringify(rc, null, 2)}\n`;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const rcPath = resolve(root, '.oxlintrc.json');
  const next = withAllowlist(readFileSync(rcPath, 'utf8'), readFileSync(resolve(root, 'app/tokens.css'), 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(rcPath, 'utf8') !== next) {
      console.error('design lint allow-list is out of date: run `node scripts/gen-lint-allowlist.mjs`');
      process.exit(1);
    }
    console.log('design lint allow-list: ok');
    return;
  }
  writeFileSync(rcPath, next);
  console.log('design lint allow-list: written');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
