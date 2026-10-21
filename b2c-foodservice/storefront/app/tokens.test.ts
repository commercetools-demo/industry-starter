import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast } from '@/test/contrast';
import { readCss, rootTokens, sourceFiles, themeTokens } from '@/test/css';

const tokens = rootTokens(readCss('app/tokens.css'));
const theme = themeTokens(readCss('app/tokens.css'));

const SPEC = readFileSync(
  join(process.cwd(), '..', 'openspec/specs/design-tokens-and-components/spec.md'),
  'utf8',
);

function componentFiles(): string[] {
  return [...sourceFiles('components'), ...sourceFiles('app').filter((f) => f.endsWith('.tsx'))];
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_VALUES: RegExp[] = [
  HEX,
  /\brgba?\(/,
  /\bhsla?\(/,
  /font-family/,
  /rounded-\[/,
  /font-\[/,
];

function rawValueHits(): string[] {
  const hits: string[] = [];
  for (const file of componentFiles()) {
    const text = readFileSync(join(process.cwd(), file), 'utf8');
    for (const re of RAW_VALUES) if (re.test(text)) hits.push(`${file}: ${re}`);
  }
  return hits;
}

describe('Single token layer', () => {
  it('Tokens in sync: every token named in the spec table exists in tokens.css', () => {
    const table = SPEC.split('\n').filter((l) => /^\| `--/.test(l));
    const names = table.flatMap((l) => [...l.split('|')[1].matchAll(/`(--[\w-]+)`/g)].map((m) => m[1]));
    expect(names.length).toBeGreaterThanOrEqual(13);
    for (const name of names) expect(tokens, name).toHaveProperty([name]);
  });

  it('No component contains a raw colour, font or radius value', () => {
    expect(componentFiles().length).toBeGreaterThanOrEqual(0);
    expect(rawValueHits()).toEqual([]);
  });

  it('Re-skin by token: replacing every colour value leaves no component with a raw value', () => {
    const css = readCss('app/tokens.css');
    const reskinned = css.replace(/#[0-9a-fA-F]{6}\b/g, '#123456');
    expect(reskinned).not.toEqual(css);
    // components reference tokens, never the values: no component repeats a hex from the token file
    const values = new Set([...css.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
    for (const file of componentFiles()) {
      const text = readFileSync(join(process.cwd(), file), 'utf8').toLowerCase();
      for (const v of values) expect(text, `${file} ${v}`).not.toContain(v);
    }
    expect(rawValueHits()).toEqual([]);
  });

  it('Tailwind mapping covers every colour token', () => {
    const semantic = [
      'ink', 'ink-2', 'ink-3', 'canvas', 'canvas-2', 'surface', 'line', 'line-2', 'accent',
      'accent-press', 'teal', 'teal-strong', 'teal-text', 'danger-text', 'stone',
      'footer-heading', 'footer-link', 'footer-meta', 'ring', 'overlay',
    ];
    for (const n of semantic) expect(theme[`--color-${n}`], n).toBe(`var(--${n})`);
    expect(theme['--color-amber']).toBe('var(--ct-amber-500)');
    expect(theme['--color-danger']).toBe('var(--ct-danger)');
    for (const r of ['pill', 'field', 'card', 'panel', 'hero']) {
      expect(theme[`--radius-${r}`]).toBe(`var(--radius-${r})`);
    }
  });

  it('Machine colour swatches exist with a fallback token', () => {
    for (const k of ['black', 'white', 'red', 'silver', 'cream']) expect(tokens).toHaveProperty([`--swatch-${k}`]);
    expect(tokens['--swatch-fallback']).toBe('var(--canvas-2)');
  });
});

describe('Accessibility', () => {
  const hex = (name: string): string => {
    const v = tokens[name];
    expect(v, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    return v;
  };

  it('Text tokens meet WCAG AA on canvas, canvas-2 and surface', () => {
    for (const bg of ['--canvas', '--canvas-2', '--surface']) {
      for (const fg of ['--ink', '--ink-2', '--ink-3', '--teal-text', '--danger-text']) {
        expect(contrast(hex(fg), hex(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(hex('--surface'), hex('--accent')), 'white on accent').toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('--surface'), hex('--danger-text')), 'white on danger').toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('--surface'), hex('--accent-press')), 'white on accent-press').toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('--surface'), hex('--ink'))).toBeGreaterThanOrEqual(4.5);
    for (const fg of ['--footer-heading', '--footer-link', '--footer-meta']) {
      expect(contrast(hex(fg), hex('--ink')), `${fg} on ink`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(hex('--teal-strong'), hex('--surface')), 'teal-strong graphic').toBeGreaterThanOrEqual(3);
  });
});
