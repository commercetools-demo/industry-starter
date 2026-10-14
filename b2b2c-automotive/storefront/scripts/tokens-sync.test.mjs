// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS_SOURCE } from './app.config.mjs';
import { diffTokens, normalise } from './tokens-source.mjs';

const local = readFileSync('app/tokens.css', 'utf8');
const source = readFileSync(path.resolve(process.cwd(), TOKENS_SOURCE), 'utf8');

describe('Styling from the automotive tokens: Tokens in sync', () => {
  it('Tokens in sync', () => {
    expect(diffTokens(local, source)).toEqual([]);
  });
  it('Tokens drift names the line', () => {
    const drifted = local.replace('--color-brand-700: #821810;', '--color-brand-700: #821811;');
    const diff = diffTokens(drifted, source).join('\n');
    expect(diff).toMatch(/--color-brand-700/);
    expect(diff).toMatch(/#821811/);
  });
  it('Google import is removed locally', () => {
    expect(local).not.toMatch(/fonts\.googleapis\.com/);
    expect(source).toMatch(/fonts\.googleapis\.com/);
    expect(normalise(source)).toBe(normalise(local));
  });
});
