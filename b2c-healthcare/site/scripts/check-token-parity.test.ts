import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareTokens, formatReport, parseTokens, stripExtensions } from './check-token-parity.mjs';

const DESIGN = `
@import url("https://fonts.example/css");
:root {
  /* Brand */
  --color-brand-500: #2aa7ff;
  --color-action: var(--color-brand-500);
  --text-xs: 12px; --text-sm: 14px;
  --gradient-sky: linear-gradient(180deg, #e7f0ff, rgba(232,241,255,.47));
}`;

const ext = (body: string) => `\n/* ==== storefront extensions ==== */\n:root {\n${body}\n}\n`;

describe('token parity', () => {
  it('Token parity: passes on identical tokens, ignoring the @import, comments and whitespace', () => {
    const storefront = `:root{--color-brand-500:#2AA7FF;--color-action:var(--color-brand-500);
      --text-xs:12px;--text-sm:14px;
      --gradient-sky: linear-gradient(180deg,   #e7f0ff, rgba(232,241,255,.47));}`;
    expect(compareTokens(DESIGN, storefront)).toEqual({ missing: [], renamed: [], changed: [], extra: [] });
  });

  it('Token parity: names a missing token', () => {
    const storefront = DESIGN.replace('--text-sm: 14px;', '');
    const report = compareTokens(DESIGN, storefront);
    expect(report.missing).toEqual(['--text-sm']);
    expect(formatReport(report)).toEqual(['missing token: --text-sm']);
  });

  it('Token parity: names a renamed token', () => {
    const storefront = DESIGN.replace('--color-brand-500:', '--color-azure-500:');
    const report = compareTokens(DESIGN, storefront);
    expect(report.renamed).toEqual([{ from: '--color-brand-500', to: '--color-azure-500' }]);
    expect(report.missing).toEqual([]);
    expect(formatReport(report)[0]).toBe('renamed token: --color-brand-500 -> --color-azure-500');
  });

  it('Token parity: names a token whose value differs', () => {
    const storefront = DESIGN.replace('#2aa7ff', '#2aa7fe');
    const report = compareTokens(DESIGN, storefront);
    expect(report.changed).toEqual([{ name: '--color-brand-500', expected: '#2aa7ff', actual: '#2aa7fe' }]);
    expect(formatReport(report)[0]).toContain('changed token: --color-brand-500');
  });

  it('Token parity: reports an unknown extra token outside the extensions block', () => {
    const storefront = DESIGN.replace('}', '  --color-extra: #000;\n}');
    expect(compareTokens(DESIGN, storefront).extra).toEqual(['--color-extra']);
  });

  it('Token parity: ignores the storefront extensions block (new tokens and redeclared names)', () => {
    const storefront = DESIGN + ext('  --color-success-700: #067a05;\n  --text-xs: 99px;');
    expect(compareTokens(DESIGN, storefront)).toEqual({ missing: [], renamed: [], changed: [], extra: [] });
    expect(stripExtensions(storefront)).not.toContain('success-700');
  });

  it('Token parity: tokens declared only inside the extensions block do not count as present', () => {
    const storefront = DESIGN.replace('--text-sm: 14px;', '') + ext('  --text-sm: 14px;');
    expect(compareTokens(DESIGN, storefront).missing).toEqual(['--text-sm']);
  });

  it('parseTokens reads several declarations per line and gradients', () => {
    const t = parseTokens(DESIGN);
    expect(t.get('--text-sm')).toBe('14px');
    expect(t.get('--gradient-sky')).toBe('linear-gradient(180deg, #e7f0ff, rgba(232,241,255,.47))');
  });

  it('Token parity: the committed app/tokens.css matches design/source/_ds/tokens.css', () => {
    const root = resolve(import.meta.dirname, '..');
    const source = readFileSync(resolve(root, '../design/source/_ds/tokens.css'), 'utf8');
    const storefront = readFileSync(resolve(root, 'app/tokens.css'), 'utf8');
    expect(formatReport(compareTokens(source, storefront))).toEqual([]);
  });
});
