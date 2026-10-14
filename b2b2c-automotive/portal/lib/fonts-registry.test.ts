/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_REGISTRY } from './fonts-registry';

describe('fonts registry', () => {
  it('Registry lists exactly the approved families', () => {
    expect(FONT_REGISTRY.map((f) => f.family)).toEqual(['Inter']);
  });
  it('Every registry variable has a font-variable override in globals.css', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const { cssVar } of FONT_REGISTRY) expect(css).toContain(`var(${cssVar})`);
  });
});
