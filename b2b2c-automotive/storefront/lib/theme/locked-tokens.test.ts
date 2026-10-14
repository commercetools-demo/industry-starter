// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildThemeCss, buildThemeVars } from './adapter';
import { MALVA_DEFAULT_THEME } from './default-theme';

// Fit badge and banner colours (workstream J) are locked: no reseller theme can change them.
const LOCKED = /--color-(success|danger)-/;
const fitComponents = ['FitBadge.tsx', 'FitBanner.tsx'];

describe('Locked fit tokens', () => {
  it('the theme adapter never emits success or danger colour declarations', () => {
    const themes = [
      MALVA_DEFAULT_THEME,
      { ...MALVA_DEFAULT_THEME, colorPrimary: '#ff0000', colorAccent: '#00ff00' },
      { colorDanger: '#123456', colorSuccess: '#654321', '--color-danger-50': '#000000', '--color-success-600': '#ffffff' },
    ];
    for (const theme of themes) {
      expect(buildThemeCss(theme)).not.toMatch(LOCKED);
      expect(Object.keys(buildThemeVars(theme)).filter((k) => LOCKED.test(k))).toEqual([]);
    }
  });

  it('the fit components use only the locked tokens for their state colours', () => {
    for (const file of fitComponents) {
      const source = readFileSync(path.join(process.cwd(), 'components/vehicle', file), 'utf8');
      expect(source).toMatch(/bg-success-50 text-success-600/);
      expect(source).toMatch(/bg-danger-50 text-danger-600/);
      expect(source).not.toMatch(/bg-(brand|accent|action)|text-(brand|accent|action)/);
    }
  });

  it('the kit defines the four tokens the fit components rely on', () => {
    const css = readFileSync(path.join(process.cwd(), 'app/tokens.css'), 'utf8');
    for (const token of ['--color-success-50', '--color-success-600', '--color-danger-50', '--color-danger-600']) expect(css).toContain(`${token}:`);
  });
});
