// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkTokenParity, checkTokens } from './check-tokens.mjs';

const siteDir = path.resolve(__dirname, '..');
const designCss = readFileSync(path.join(siteDir, '..', 'design', 'source', '_ds', 'tokens.css'), 'utf8');
const themeCss = readFileSync(path.join(siteDir, 'app', 'globals.css'), 'utf8');

describe('checkTokenParity', () => {
  it('passes on identical tokens', () => {
    expect(checkTokenParity(designCss, themeCss)).toEqual([]);
  });

  it('Token parity: a missing, renamed or changed token is reported by name', () => {
    const missing = themeCss.replace(/ {2}--color-brand-500: #f9c162;\n/, '');
    expect(checkTokenParity(designCss, missing)).toContain('token --color-brand-500 is missing from the theme');

    const renamed = themeCss.replace('--color-brand-500:', '--color-brandd-500:');
    const renamedProblems = checkTokenParity(designCss, renamed);
    expect(renamedProblems).toContain('token --color-brand-500 is missing from the theme');
    expect(renamedProblems).toContain(
      'token --color-brandd-500 is in the design part of the theme but not in tokens.css (rename or move below the extensions line)',
    );

    const changed = themeCss.replace('--color-brand-500: #f9c162', '--color-brand-500: #f9c163');
    expect(checkTokenParity(designCss, changed)).toContain('token --color-brand-500 differs: design "#f9c162" vs theme "#f9c163"');
  });

  it('reports a font token without the next/font variable prefix', () => {
    const unprefixed = themeCss.replace('var(--font-exo), ', '');
    const problems = checkTokenParity(designCss, unprefixed);
    expect(problems.some((problem) => problem.startsWith('token --font-display differs'))).toBe(true);
  });

  it('reports an extension that reuses a design token name', () => {
    const reused = themeCss.replace('--ext-space-12: 12px;', '--space-5: 12px; --ext-space-12: 12px;');
    expect(checkTokenParity(designCss, reused)).toContain('extension --space-5 reuses a design token name');
  });

  it('reports the Google Fonts host in the theme', () => {
    const problems = checkTokenParity(designCss, `${themeCss}\n@import url("https://fonts.googleapis.com/css2");`);
    expect(problems).toContain('fonts: found fonts.googleapis.com in app/globals.css');
  });

  it('passes on the real files', () => {
    expect(checkTokens(siteDir)).toEqual([]);
  });
});
