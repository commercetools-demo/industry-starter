// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = new Map<string, string>();
for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(match[1], match[2].trim());

/** Resolves a token through var() aliases to a hex color. */
function resolve(name: string): string {
  let value = tokens.get(`--color-${name}`);
  for (let depth = 0; depth < 10 && value !== undefined; depth += 1) {
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (!alias) break;
    value = tokens.get(alias[1]);
  }
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--color-${name} does not resolve to a hex color (${value})`);
  return value;
}

function channel(hex: string, offset: number): number {
  const srgb = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG 2 contrast ratio between two tokens. */
function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(resolve(foreground)), luminance(resolve(background))].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('design token contrast (WCAG 2 AA)', () => {
  it('Text on a brand surface: text-on-brand passes AA on brand-50 to 500, white does not on brand-500', () => {
    for (const step of ['50', '100', '200', '300', '400', '500']) {
      expect(contrast('text-on-brand', `brand-${step}`), `brand-${step}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('text-on-brand', 'brand-500')).toBeCloseTo(7.82, 1);
    expect(contrast('neutral-0', 'brand-500')).toBeLessThan(4.5);
  });

  it('white text passes on pink-700 and darker and on brand-950', () => {
    for (const background of ['pink-700', 'pink-800', 'pink-900', 'pink-950', 'brand-950']) {
      expect(contrast('text-on-pink', background), background).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('text-on-pink', 'pink-700')).toBeCloseTo(6.01, 1);
  });

  it('link, muted, danger and breadcrumb text pass on their surfaces', () => {
    expect(contrast('text-link', 'surface')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('text-link', 'brand-100')).toBeCloseTo(5.18, 1);
    expect(contrast('text-link', 'brand-100')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('text-muted', 'surface')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('text-muted', 'surface-subtle')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('danger', 'surface')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('brand-900', 'brand-100')).toBeCloseTo(6.87, 1);
    expect(contrast('brand-900', 'brand-100')).toBeGreaterThanOrEqual(4.5);
  });
});
