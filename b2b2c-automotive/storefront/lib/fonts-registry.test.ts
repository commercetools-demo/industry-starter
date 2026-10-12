// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FONT_REGISTRY } from './fonts-registry';

describe('Styling from the automotive tokens: fonts', () => {
  it('Registry lists exactly the approved families', () => {
    expect(FONT_REGISTRY.map((f) => f.family)).toEqual(['Poppins', 'Archivo', 'Public Sans', 'Inter']);
  });
  it('Every registry variable has a font-variable override in globals.css', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    for (const { cssVar } of FONT_REGISTRY) expect(css).toContain(`var(${cssVar})`);
  });
  it('lib/fonts.ts declares the same variables', () => {
    const src = readFileSync('lib/fonts.ts', 'utf8');
    for (const { cssVar, family } of FONT_REGISTRY) {
      expect(src).toContain(`variable: '${cssVar}'`);
      expect(src).toContain(family.replace(' ', '_'));
    }
  });
});
