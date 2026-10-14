/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { parseEnv, readArgs, SEEDED_STORES } from './catalog-live.mjs';

describe('catalog live scripts helper', () => {
  it('parses env lines without keeping comments', () => {
    expect(parseEnv('# c\nA=1\nB="two"\n')).toEqual({ A: '1', B: 'two' });
  });

  it('accepts a seeded store key and returns the rest', () => {
    const { storeKey, rest } = readArgs(['mau-reseller-north', 'SKU-1', 'present'], { usage: 'u' });
    expect(storeKey).toBe('mau-reseller-north');
    expect(rest).toEqual(['SKU-1', 'present']);
    expect(Object.keys(SEEDED_STORES)).toContain(storeKey);
  });

  it('refuses an unseeded store key unless --allow-any is passed', () => {
    const exit = process.exit;
    process.exit = (code) => {
      throw new Error(`exit ${code}`);
    };
    const error = console.error;
    console.error = () => undefined;
    try {
      expect(() => readArgs(['other-store'], { usage: 'u' })).toThrow('exit 1');
      expect(readArgs(['other-store', '--allow-any'], { usage: 'u' }).storeKey).toBe('other-store');
    } finally {
      process.exit = exit;
      console.error = error;
    }
  });
});
