// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

describe('globals.css tokens', () => {
  it.each([
    '--color-accent: #c67139',
    '--color-bg: #f5ead8',
    '--radius-lg: 28px',
    '--space-4: 17.6px',
    '--font-heading-weight: 400',
  ])('has %s', (token) => {
    expect(css).toContain(token);
  });

  it('Scaffold palette removed', () => {
    expect(css).not.toMatch(/cream|terra\b|--color-terra|Inter\b/);
  });

  it('imports tailwind and the component classes, with the span safelist', () => {
    expect(css).toContain("@import 'tailwindcss'");
    expect(css).toContain("@import './organic-components.css'");
    expect(css).toContain('col-span-{1..12}');
  });
});
