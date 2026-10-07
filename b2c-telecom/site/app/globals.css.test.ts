import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

describe('app/globals.css', () => {
  it('carries the design tokens verbatim', () => {
    for (const decl of [
      '--color-brand-500: #f9c162',
      '--color-action: var(--color-pink-700)',
      '--radius-pill: 100px',
      '--space-5: 16px',
      '--container-width: 1440px',
      '--color-danger: #a1262b',
    ]) {
      expect(css).toContain(decl);
    }
  });

  it('does not contain the Google Fonts import or the old palette', () => {
    expect(css).not.toContain('fonts.googleapis');
    expect(css).not.toContain('cream');
    expect(css).not.toContain('terra');
  });

  it('Actions are pink: --color-action is pink-700 and --color-action-hover is pink-800', () => {
    expect(css).toContain('--color-action: var(--color-pink-700);');
    expect(css).toContain('--color-action-hover: var(--color-pink-800);');
  });

  it('uses @theme static and puts the next/font variable first in the font tokens', () => {
    expect(css).toContain('@theme static {');
    expect(css).toContain('--font-display: var(--font-exo), "Exo", system-ui, sans-serif;');
    expect(css).toContain('--font-cta: var(--font-inter), "Inter", system-ui, sans-serif;');
    expect(css).toContain('--font-body: var(--font-roboto), "Roboto", system-ui, sans-serif;');
  });
});
