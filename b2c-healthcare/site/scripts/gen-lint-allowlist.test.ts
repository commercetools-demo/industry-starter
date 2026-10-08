import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokenAllowlist, withAllowlist } from './gen-lint-allowlist.mjs';

const CSS = ':root { --color-b: #000; --color-a: red; --text-xs: 12px; } /* x */ :root { --focus-ring: 1px; }';

describe('gen-lint-allowlist', () => {
  it('lists every custom property, sorted', () => {
    expect(tokenAllowlist(CSS)).toEqual(['--color-a', '--color-b', '--focus-ring', '--text-xs']);
  });

  it('keeps the rest of the config and replaces only the allow-list', () => {
    const rc = JSON.stringify({ rules: { a: 1 }, 'x-omelette': { tokens: 'TRIMMED', fontFamilies: ['Lato'] } });
    const out = JSON.parse(withAllowlist(rc, CSS));
    expect(out.rules).toEqual({ a: 1 });
    expect(out['x-omelette'].fontFamilies).toEqual(['Lato']);
    expect(out['x-omelette'].tokens).toContain('--focus-ring');
  });

  it('--check passes on the committed .oxlintrc.json', () => {
    const root = resolve(import.meta.dirname, '..');
    const out = execFileSync('node', ['scripts/gen-lint-allowlist.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('ok');
  });
});
