import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { designLintConfigs, readAdherenceSelectors } from './design-lint.mjs';

const root = resolve(__dirname, '..');
const linter = new Linter({ configType: 'flat', cwd: root });
const config = [
  { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
  ...designLintConfigs,
] as Linter.Config[];

function lint(filename: string, code: string) {
  return linter.verify(code, config, { filename: join(root, filename) });
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const FIXTURE =`export function Bad() {
  const a = { color: '#fff' };
  const b = { padding: '13px' };
  const c = 'font-family: Arial';
  return <div style={{ ...a, ...b }} data-c={c} />;
}
`;

describe('design lint', () => {
  it('Raw value in a component: hex, px and a foreign font family warn with the rule messages', () => {
    const messages = lint('components/dev/Fixture.tsx', FIXTURE);
    expect(messages.map((m) => m.message)).toEqual([
      'Raw hex color — use a design-system color token via var().',
      'Raw px value — use a design-system spacing token via var().',
      'Font not provided by the design system. Available: Lato, Poppins, Roboto.',
    ]);
    expect(messages.every((m) => m.ruleId === 'design/adherence' && m.severity === 1)).toBe(true);
  });

  it('Raw value in a component: tokens, var() and the design fonts are accepted', () => {
    const code = `export const ok = { color: 'var(--color-brand-600)', padding: 'var(--space-5)' };
export const f = "font-family:'Poppins', sans-serif";
`;
    expect(lint('components/dev/Ok.tsx', code)).toEqual([]);
  });

  it('Raw value in a component: test files are not linted', () => {
    expect(lint('components/dev/Fixture.test.tsx', FIXTURE)).toEqual([]);
  });

  it('uses the selectors of .oxlintrc.json, which carry the design adherence rules verbatim', () => {
    const design = JSON.parse(readFileSync(resolve(root, '../design/source/_ds/_adherence.oxlintrc.json'), 'utf8'));
    const mine = JSON.parse(readFileSync(resolve(root, '.oxlintrc.json'), 'utf8'));
    expect(mine.rules).toEqual(design.rules);
    expect(mine.overrides).toEqual(design.overrides);
    expect(mine.plugins).toEqual(design.plugins);
    expect(readAdherenceSelectors()).toHaveLength(3);
  });

  it('the generated allow-list covers every custom property of app/tokens.css', () => {
    const rc = JSON.parse(readFileSync(resolve(root, '.oxlintrc.json'), 'utf8'));
    const css = readFileSync(resolve(root, 'app/tokens.css'), 'utf8');
    const declared = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))].sort();
    expect(rc['x-omelette'].tokens).toEqual(declared);
    expect(rc['x-omelette'].fontFamilies).toEqual(['Lato', 'Poppins', 'Roboto']);
  });

  it('every var(--token) used in app/ and components/ is on the allow-list', () => {
    const rc = JSON.parse(readFileSync(resolve(root, '.oxlintrc.json'), 'utf8'));
    const allowed = new Set<string>([...rc['x-omelette'].tokens, '--font-poppins', '--font-lato', '--font-roboto']);
    const unknown: string[] = [];
    for (const file of ['app', 'components'].flatMap((d) => walk(join(root, d)))) {
      if (!/\.(tsx?|css)$/.test(file) || /\.test\.|tokens\.css$|globals\.css$/.test(file)) continue;
      for (const m of readFileSync(file, 'utf8').matchAll(/var\(\s*(--[\w-]+)/g)) {
        const name = m[1];
        // a trailing "-" is a template prefix (var(--color-${scale}-...)): some token must start with it
        const known = name.endsWith('-') ? [...allowed].some((t) => t.startsWith(name)) : allowed.has(name);
        if (!known && !name.startsWith('--tw-')) unknown.push(`${file}: ${name}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});

