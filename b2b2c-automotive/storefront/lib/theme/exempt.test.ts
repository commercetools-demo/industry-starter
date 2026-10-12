// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintSource, tokenMap } from '../../scripts/check-tokens.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const tokens = tokenMap(readFileSync(path.join(root, 'app/tokens.css'), 'utf8'));
const raw = "export const a = { color: '#821810', radius: '9px', font: { fontFamily: 'Archivo' } };";

describe('Raw values are rejected at review: lib/theme exemptions', () => {
  it('Only default-theme, color and shadows are exempt inside lib/theme', () => {
    const files = readdirSync(path.join(root, 'lib/theme')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const exempt = files.filter((f) => (lintSource(`lib/theme/${f}`, raw, tokens) as string[]).length === 0).sort();
    expect(exempt).toEqual(['color.ts', 'default-theme.ts', 'shadows.ts']);
  });
  it('The theme sources that are not exempt pass the lint as written', () => {
    const files = readdirSync(path.join(root, 'lib/theme')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    for (const f of files) {
      expect(lintSource(`lib/theme/${f}`, readFileSync(path.join(root, 'lib/theme', f), 'utf8'), tokens, ['--btn-secondary-bg'])).toEqual([]);
    }
  });
});
