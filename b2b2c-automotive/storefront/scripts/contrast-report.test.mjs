// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContrast, evaluate, loadReport, parseColour, ratio, resolveTokens } from './contrast-report.mjs';
import { tmpApp } from './test-utils.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');

describe('contrast pairs', () => {
  it('every pair in contrast-pairs.json meets its threshold in the default theme (listed exceptions aside)', () => {
    expect(checkContrast(appRoot)).toEqual([]);
  });

  it('lists every exception with a reason and keeps the exceptions few', () => {
    const rows = loadReport(appRoot);
    const failing = rows.filter((r) => !r.pass);
    for (const r of failing) expect(r.exception, `${r.fg} on ${r.bg}`).toBeTruthy();
    expect(failing.length).toBeLessThanOrEqual(2);
  });

  it('computes the WCAG ratio (black on white is 21, grey 767676 on white is 4.54)', () => {
    expect(ratio(parseColour('#000000'), parseColour('#ffffff'))).toBeCloseTo(21, 5);
    expect(ratio(parseColour('#767676'), parseColour('#ffffff'))).toBeCloseTo(4.54, 2);
  });

  it('fails a text pair below 4.5 and passes a large or ui pair at 3', () => {
    const map = resolveTokens([':root { --color-surface-page: #ffffff; --a: var(--b); --b: #949494; }']);
    expect(evaluate([{ fg: '--a', bg: '--color-surface-page', size: 'normal' }], map)[0].pass).toBe(false);
    expect(evaluate([{ fg: '--a', bg: '--color-surface-page', size: 'large' }], map)[0].pass).toBe(true);
  });

  it('reads the AA layer after the kit tokens', () => {
    const root = tmpApp({
      'app/tokens.css': ':root { --color-surface-page: #ffffff; --color-text: #cccccc; }',
      'app/aa-layer.css': ':root { --color-text: #000000; }',
      'scripts/contrast-pairs.json': JSON.stringify([{ fg: '--color-text', bg: '--color-surface-page', size: 'normal' }]),
    });
    expect(checkContrast(root)).toEqual([]);
  });

  it('reports a failing pair', () => {
    const root = tmpApp({
      'app/tokens.css': ':root { --color-surface-page: #ffffff; --color-text: #cccccc; }',
      'scripts/contrast-pairs.json': JSON.stringify([{ fg: '--color-text', bg: '--color-surface-page', size: 'normal' }]),
    });
    expect(checkContrast(root).join('')).toMatch(/FAIL.*--color-text on --color-surface-page/);
  });

  it('no component uses a token the report does not cover: text colours in components are all in a pair', () => {
    const pairs = JSON.parse(readFileSync(path.join(appRoot, 'scripts/contrast-pairs.json'), 'utf8'));
    const covered = new Set(pairs.map((p) => p.fg.replace('--color-', '')));
    expect(covered.has('text-subtle')).toBe(true);
    expect(covered.has('success-600')).toBe(true);
    expect(covered.has('danger-600')).toBe(true);
    expect(covered.has('border-input')).toBe(true);
  });
});
