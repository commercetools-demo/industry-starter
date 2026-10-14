/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { compile } from '@tailwindcss/node';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkThemeBlock } from './gen-theme-block.mjs';

const root = path.resolve(import.meta.dirname, '..');
const globals = readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

async function build(candidates) {
  const compiler = await compile(globals, { base: path.join(root, 'app'), onDependency() {} });
  return compiler.build(candidates);
}

describe('Styling from the admin kit (Tailwind)', () => {
  it('Utilities resolve to CSS variables', async () => {
    const css = await build(['bg-bg-surface', 'text-text', 'p-400', 'rounded-300', 'font-sans', 'text-h1', 'shadow-card', 'h-topbar', 'bg-bg-topbar']);
    expect(css).toContain('background-color: var(--color-bg-surface)');
    expect(css).toContain('color: var(--color-text)');
    expect(css).toContain('padding: var(--space-400)');
    expect(css).toContain('border-radius: var(--radius-300)');
    expect(css).toContain('font-family: var(--font-sans)');
    expect(css).toContain('font-size: var(--text-h1)');
    expect(css).toContain('var(--tracking-h1)');
    expect(css).toContain('var(--shadow-card)');
    expect(css).toContain('height: var(--topbar-height)');
    expect(css).toContain('background-color: var(--color-bg-topbar)');
    const utilities = /@layer utilities \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(utilities).toContain('.bg-bg-surface');
    expect(utilities).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('Default palette is gone', async () => {
    const css = await build(['bg-red-500', 'text-white', 'p-4', 'text-lg', 'rounded-md']);
    const utilities = /@layer utilities \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(utilities).not.toMatch(/\.(bg-red-500|text-white|p-4|text-lg|rounded-md)\b/);
  });
  it('Theme block is current', () => {
    expect(checkThemeBlock(root)).toEqual([]);
  });
});
