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
      '--color-text-link: var(--color-brand-800)',
      '--color-text-muted: var(--color-neutral-600)',
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

  it('Z: the effective link color reaches 4.5:1 on white and on brand-50 (axe color-contrast)', () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const hex = (name: string) => new RegExp(`${name}: (#[0-9a-f]{6})`).exec(tokensCss)?.[1] as string;
    const link = /--color-text-link: var\(--color-(brand-\d+)\)/.exec(tokensCss.split(MARKER)[1] ?? '')?.[1] as string;
    const linkHex = hex(`--color-${link}`);
    expect(ratio(linkHex, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(linkHex, hex('--color-brand-50'))).toBeGreaterThanOrEqual(4.5);
    const muted = /--color-text-muted: var\(--color-(neutral-\d+)\)/.exec(tokensCss.split(MARKER)[1] ?? '')?.[1] as string;
    expect(ratio(hex(`--color-${muted}`), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
