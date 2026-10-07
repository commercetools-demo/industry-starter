// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SITE = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(SITE, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// design/source/_ds/tokens.css carries the design tokens; app/globals.css adds the extension tokens (danger).
const DECLARATIONS = new Map<string, string>();
for (const css of [read('../design/source/_ds/tokens.css'), read('app/globals.css')]) {
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) DECLARATIONS.set(match[1], match[2].trim());
}

function resolve(name: string, depth = 0): string {
  const value = DECLARATIONS.get(name);
  if (value === undefined || depth > 8) throw new Error(`token ${name} not found`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? resolve(alias[1], depth + 1) : value;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function ratio(foreground: string, background: string): number {
  const a = luminance(resolve(`--color-${foreground}`));
  const b = luminance(resolve(`--color-${background}`));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT_AA = 4.5;
const UI_AA = 3;

const PAIRS: [string, string, string, number][] = [
  ['text-on-brand', 'brand-500', 'header text, nav, brand cards', TEXT_AA],
  ['brand-900', 'brand-100', 'breadcrumb, title strips', TEXT_AA],
  ['text-on-pink', 'pink-700', 'primary CTA', TEXT_AA],
  ['neutral-0', 'brand-950', 'active pill, bundle pill, toast', TEXT_AA],
  ['brand-100', 'brand-950', 'footer links', TEXT_AA],
  ['brand-300', 'brand-950', 'footer copyright', TEXT_AA],
  ['pink-700', 'surface', 'links, secondary CTA text', TEXT_AA],
  ['pink-700', 'pink-50', 'callouts, secondary CTA hover', TEXT_AA],
  ['text-muted', 'surface', 'muted text', TEXT_AA],
  ['danger', 'surface', 'form errors', TEXT_AA],
  ['neutral-0', 'danger', 'error toast', TEXT_AA],
  ['brand-950', 'brand-100', 'filter chip', TEXT_AA],
  ['pink-800', 'pink-50', 'pink tag', TEXT_AA],
  ['pink-700', 'brand-500', 'focus ring next to header surfaces', UI_AA],
  ['brand-950', 'brand-500', 'focus ring on the header', UI_AA],
  ['brand-500', 'brand-950', 'focus ring on dark surfaces', UI_AA],
  ['action', 'surface', 'focus ring on the page', UI_AA],
];

describe('token contrast (WCAG 2)', () => {
  it.each(PAIRS)('%s on %s meets its minimum (%s)', (foreground, background, _use, minimum) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it('documents why brand-800 is not allowed on brand-100', () => {
    expect(ratio('brand-800', 'brand-100')).toBeLessThan(TEXT_AA);
  });

  it('the token danger is the extension value', () => {
    expect(resolve('--color-danger')).toBe('#a1262b');
  });
});
