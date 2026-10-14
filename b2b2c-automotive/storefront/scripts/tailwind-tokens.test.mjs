// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { compile } from '@tailwindcss/node';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildThemeBlock, themeBlockProblems } from './gen-theme-block.mjs';

const appDir = path.resolve(process.cwd(), 'app');
const globals = readFileSync(path.join(appDir, 'globals.css'), 'utf8');
const tokens = readFileSync(path.join(appDir, 'tokens.css'), 'utf8');

async function build(candidates) {
  const compiler = await compile(globals, { base: appDir, onDependency: () => {} });
  return compiler.build(candidates);
}

describe('Styling from the automotive tokens: Tailwind wiring', () => {
  it('Utilities resolve to CSS variables', async () => {
    const css = await build(['bg-brand-700', 'text-text', 'p-4', 'p-5', 'rounded-md', 'font-display', 'shadow-card', 'text-lg', 'max-w-page', 'bg-action']);
    expect(css).toContain('var(--color-brand-700)');
    expect(css).toContain('var(--color-text)');
    expect(css).toContain('padding: var(--space-4)');
    expect(css).toContain('padding: var(--space-5)');
    expect(css).toContain('var(--radius-md)');
    expect(css).toContain('var(--font-display)');
    expect(css).toContain('var(--shadow-card)');
    expect(css).toContain('var(--text-lg)');
    expect(css).toContain('var(--color-action)');
    // utilities must not carry raw colour values; the token file itself is imported separately
    expect(css).not.toMatch(/\n\s+(background-color|color|border-color|fill|stroke):\s*#/);
  });
  it('The unlayered token value wins over the layered same-name theme alias (no custom property cycle)', async () => {
    const css = await build(['bg-brand-700']);
    // Tailwind emits `--color-brand-700: var(--color-brand-700)` inside `@layer theme`; the token file is imported
    // unlayered (two-space indent at top level), and unlayered declarations always beat layered ones.
    expect(css).toMatch(/\n {2}--color-brand-700: #821810;/);
    expect(css).not.toMatch(/@layer\s+tokens/);
  });
  it('Default palette is gone', async () => {
    const css = await build(['bg-red-500', 'text-white']);
    expect(css).not.toMatch(/\.bg-red-500|\.text-white/);
  });
  it('Theme block is current', () => {
    expect(themeBlockProblems(globals, tokens)).toEqual([]);
    expect(buildThemeBlock(tokens)).toContain('--spacing-5: var(--space-5);');
  });
});
