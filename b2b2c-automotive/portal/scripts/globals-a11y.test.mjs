import { describe, expect, it } from 'vitest';
import { readApp } from './test-utils.mjs';

const css = readApp('app/globals.css');
const tokens = readApp('app/tokens.css');
const space = (name) => Number(new RegExp(`--space-${name}:\\s*(\\d+)px`).exec(tokens)?.[1]);

describe('global accessibility rules of app/globals.css', () => {
  it('a focused control scrolls clear of the fixed Copilot launcher (2.4.11)', () => {
    const launcher = readApp('components/portal/CopilotPanel.tsx');
    expect(launcher).toContain('fixed bottom-600 right-600');
    expect(launcher).toContain('h-1200');
    const footprint = space('600') + space('1200');
    const padding = /html\s*\{[^}]*scroll-padding-bottom:\s*var\(--space-(\d+)\)/.exec(css)?.[1];
    expect(padding, 'html { scroll-padding-bottom } is missing').toBeTruthy();
    expect(space(padding)).toBeGreaterThanOrEqual(footprint);
  });

  it('every control has a visible focus indicator that the kit defines (2.4.7)', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--shadow-focus\)/);
    expect(tokens).toMatch(/--shadow-focus:\s*0 0 0 2px/);
  });

  it('the page language and the AA text layer are in place', () => {
    expect(readApp('app/layout.tsx')).toContain('<html lang=');
    expect(css).toContain('--color-text-subdued: var(--color-gray-13)');
  });
});
