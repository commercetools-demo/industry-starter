// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkTokenParity, checkTokens, findDesignViolations } from './check-tokens.mjs';

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

describe('findDesignViolations', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'check-tokens-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function put(rel: string, content: string) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  it('reports a raw hex or px value in a css file', () => {
    put('components/ui/x.css', '.a { color: #fff; }\n.b { margin: 4px; }\n');
    expect(findDesignViolations(dir)).toEqual(['components/ui/x.css:1: raw value', 'components/ui/x.css:2: raw value']);
  });

  it('ignores app/globals.css, the label folder and test files', () => {
    put('app/globals.css', ':root { --a: #fff; --b: 4px; }');
    put('components/label/x.css', '.a { color: #000; padding: 2px; }');
    put('components/label/BroadbandLabel.tsx', 'export const a = "text-white";');
    put('components/ui/x.test.tsx', 'export const a = "text-white";');
    expect(findDesignViolations(dir)).toEqual([]);
  });

  it('reports a font that is not a design font', () => {
    put('app/f.ts', "import { Lato } from 'next/font/google';\nexport const lato = Lato({});\n");
    expect(findDesignViolations(dir)).toContain('fonts: Lato is not a design font (app/f.ts)');
  });

  it('accepts the three design fonts and reports Google Fonts hosts', () => {
    put('app/fonts.ts', "import { Exo, Inter as I, Roboto } from 'next/font/google';\nexport const a = [Exo, I, Roboto];\n");
    expect(findDesignViolations(dir)).toEqual([]);
    put('components/ui/h.tsx', 'export const a = "https://fonts.gstatic.com/x";');
    expect(findDesignViolations(dir).some((problem) => problem.startsWith('components/ui/h.tsx: fonts:'))).toBe(true);
  });

  it('Text on a brand surface: text-white and text-on-pink on a light brand background are reported', () => {
    put('components/ui/a.tsx', 'export const a = <p className="text-white">x</p>;\n');
    expect(findDesignViolations(dir)).toEqual([
      'components/ui/a.tsx:1: use text-text-on-pink on pink-700 or darker, text-text-on-brand on brand surfaces, never white',
    ]);

    put('components/ui/a.tsx', 'export const a = <p className="text-text-on-pink bg-brand-500">x</p>;\n');
    expect(findDesignViolations(dir)).toEqual(['components/ui/a.tsx:1: text-on-pink on a light brand surface']);

    put('components/ui/a.tsx', 'export const a = <p className="text-text-on-pink bg-pink-700">x</p>;\n');
    expect(findDesignViolations(dir)).toEqual([]);

    put('components/ui/a.tsx', 'export const a = <p className="text-text-on-brand bg-brand-500">x</p>;\n');
    expect(findDesignViolations(dir)).toEqual([]);
  });
});
