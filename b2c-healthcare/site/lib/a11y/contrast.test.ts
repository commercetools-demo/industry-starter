import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, meetsAA, relativeLuminance } from './contrast';

// Resolve a token from app/tokens.css (follows var() aliases; the storefront extensions block wins, like the cascade).
const css = readFileSync(resolve(__dirname, '../../app/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const declared = new Map<string, string>();
for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1], m[2].trim());
function token(name: string): string {
  const v = declared.get(name);
  if (!v) throw new Error(`unknown token ${name}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(v);
  return alias ? token(alias[1]) : v;
}

describe('contrast helper', () => {
  it('parses hex colors', () => {
    expect(hexToRgb('#2aa7ff')).toEqual([42, 167, 255]);
    expect(hexToRgb('#FFF')).toEqual([255, 255, 255]);
    expect(() => hexToRgb('red')).toThrow();
  });

  it('matches the WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it('Primary button label: white on #2aa7ff is about 2.6:1 and fails AA', () => {
    const ratio = contrastRatio(token('--color-text-on-brand'), token('--color-action'));
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(2.7);
    expect(meetsAA(token('--color-text-on-brand'), token('--color-action'))).toBe(false);
  });

  it('Primary button label: --color-action-label (navy-900) on --color-action reaches 4.5:1', () => {
    expect(token('--color-action-label')).toBe(token('--color-navy-900'));
    expect(contrastRatio(token('--color-action-label'), token('--color-action'))).toBeGreaterThanOrEqual(4.5);
    expect(meetsAA(token('--color-action-label'), token('--color-action'))).toBe(true);
  });

  it('Primary button label: on hover navy-900 on brand-600 is only 4.38:1, so the hover label is navy-950', () => {
    expect(meetsAA(token('--color-action-label'), token('--color-action-hover'))).toBe(false);
    expect(token('--color-action-label-hover')).toBe(token('--color-navy-950'));
    expect(meetsAA(token('--color-action-label-hover'), token('--color-action-hover'))).toBe(true);
  });

  it.each(['success', 'warning', 'info', 'danger'])('Status text meets contrast: %s-700 on %s-50 is at least 4.5:1', (status) => {
    const ratio = contrastRatio(token(`--color-${status}-700`), token(`--color-${status}-50`));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Status text meets contrast: the 500 status colors alone do not (hence the -700 extensions)', () => {
    for (const status of ['success', 'warning', 'info', 'danger']) {
      expect(meetsAA(token(`--color-${status}-500`), token(`--color-${status}-50`))).toBe(false);
    }
  });

  it('Keyboard focus: the focus ring color reaches 3:1 against white', () => {
    const ring = /var\((--[\w-]+)\)/.exec(token('--focus-ring').replace(/^[^v]*(?=var)/, ''))?.[1];
    expect(ring).toBeDefined();
    expect(contrastRatio(token(ring as string), token('--color-surface'))).toBeGreaterThanOrEqual(3);
  });
});
