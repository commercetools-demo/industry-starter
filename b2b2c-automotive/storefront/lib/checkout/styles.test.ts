// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCheckoutStyles, CHECKOUT_STYLE_TOKENS } from './styles';

const fakeComputed: Record<string, string> = {
  '--color-action': 'rgb(1, 2, 3)',
  '--color-action-hover': 'rgb(4, 5, 6)',
  '--color-text-on-brand': 'rgb(255, 255, 255)',
  '--color-border-strong': 'rgb(9, 9, 9)',
  '--color-text-subtle': 'rgb(8, 8, 8)',
  '--color-focus': 'rgb(7, 7, 7)',
  '--font-ui': '"Public Sans", system-ui, sans-serif',
};

describe('buildCheckoutStyles', () => {
  it('styles are built from computed tokens', () => {
    const styles = buildCheckoutStyles((name) => fakeComputed[name] ?? '');
    for (const variable of Object.keys(CHECKOUT_STYLE_TOKENS)) expect(styles).toHaveProperty(variable);
    expect(styles['--button']).toBe('rgb(1, 2, 3)');
    expect(styles['--button-hover']).toBe('rgb(4, 5, 6)');
    expect(styles['--font-family']).toBe('Public Sans');
  });
  it('a reseller theme reaches the widget', () => {
    const themed = buildCheckoutStyles((name) => (name === '--color-action' ? 'rgb(0, 80, 160)' : (fakeComputed[name] ?? '')));
    expect(themed['--button']).toBe('rgb(0, 80, 160)');
    expect(themed['--spinner']).toBe('rgb(0, 80, 160)');
  });
  it('missing tokens are left out', () => {
    expect(buildCheckoutStyles(() => '')).toEqual({});
  });
  it('only variables the SDK documents are produced', () => {
    const allowed = new Set(['--button', '--button-outline', '--button-hover', '--button-text', '--button-disabled', '--button-disabled-text', '--input-field-focus', '--checkbox', '--radio', '--spinner', '--font-family']);
    for (const key of Object.keys(buildCheckoutStyles((name) => fakeComputed[name] ?? ''))) expect(allowed.has(key)).toBe(true);
  });
  it('no literal colour or font name is in the source', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, 'styles.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|Poppins|Inter\b|Public Sans/);
  });
});
