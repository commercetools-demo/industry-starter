// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const globals = readFileSync(path.join(root, 'app/globals.css'), 'utf8');
const components = readFileSync(path.join(root, 'app/organic-components.css'), 'utf8');

const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(globals);
  if (!match) throw new Error(`token ${name} not found`);
  return match[1];
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe('Accent as body text', () => {
  it('the base accent is only about 3:1 on the ground and the 700 step passes 4.5:1', () => {
    const bg = token('color-bg');
    expect(contrast(token('color-accent'), bg)).toBeLessThan(4.5);
    expect(contrast(token('color-accent'), bg)).toBeGreaterThan(2.9);
    expect(contrast(token('color-accent-700'), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('component and global CSS never set a text colour to the base accent', () => {
    for (const css of [globals, components]) {
      expect(css).not.toMatch(/(^|[\s;{])color:\s*var\(--color-accent\)/m);
    }
  });

  it('only the filled heart icon uses the base accent as a text colour in components', () => {
    const offenders = [...sources(path.join(root, 'app')), ...sources(path.join(root, 'components'))].filter((file) => /(^|[\s:'"])text-accent(?![-\w])/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual(['components/ui/HeartButton.tsx']);
  });
});

describe('Disabled control and tile lift', () => {
  it('disabled controls render at 45% opacity', () => {
    expect(globals).toContain(':disabled { opacity: 0.45');
    expect(components).toContain('.btn:disabled { opacity: 0.45');
  });

  it('.lift raises the element by 4 px on hover', () => {
    expect(components).toContain('.lift:hover { transform: translateY(-4px); }');
  });
});
