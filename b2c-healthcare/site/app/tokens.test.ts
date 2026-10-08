import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');
const tokensCss = read('tokens.css');
const globalsCss = read('globals.css');
const MARKER = '==== storefront extensions ====';

describe('app/tokens.css and globals.css', () => {
  it('globals.css imports tokens.css after tailwind', () => {
    expect(globalsCss).toMatch(/@import 'tailwindcss';\s*@import '\.\/tokens\.css';/);
  });

  it('does not carry the runtime Google Fonts import', () => {
    expect(tokensCss).not.toMatch(/@import/);
    expect(tokensCss).not.toContain(['fonts', 'googleapis', 'com'].join('.'));
  });

  it('flags the storefront extensions block with the D-008/D-009/D-010 tokens', () => {
    const ext = tokensCss.split(MARKER)[1];
    expect(ext).toBeDefined();
    for (const name of [
      '--color-success-700: #067a05',
      '--color-warning-700: #8a5d00',
      '--color-info-700: #0a6f8c',
      '--color-danger-700: #b3402a',
      '--container-content: 1200px',
      '--color-action-label: var(--color-navy-900)',
      '--focus-ring:',
    ]) {
      expect(ext).toContain(name);
    }
  });

  it('keeps --container-width verbatim', () => {
    expect(tokensCss.split(MARKER)[0]).toContain('--container-width: 1440px');
  });

  it('maps every color, text, radius and shadow token in @theme inline', () => {
    const theme = globalsCss.split('@theme inline')[1] ?? '';
    const names = [...tokensCss.matchAll(/(--(?:color|text|radius|shadow)-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(60);
    for (const n of new Set(names)) {
      expect(theme, n).toContain(`${n}: var(${n});`);
    }
  });
});
