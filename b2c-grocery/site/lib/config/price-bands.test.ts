/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { getPriceBands } from './price-bands';

describe('getPriceBands', () => {
  it('EUR: returns the four band ids', () => {
    expect(getPriceBands('EUR').map((b) => b.id)).toEqual(['lt-500', '500-1500', '1500-3000', 'gt-3000']);
  });
  it('USD: same bands as EUR', () => {
    expect(getPriceBands('USD')).toEqual(getPriceBands('EUR'));
  });
  it('bands are contiguous', () => {
    const bands = getPriceBands('USD');
    for (let i = 1; i < bands.length; i++) expect(bands[i].min).toBe(bands[i - 1].max);
  });
  it('unknown currency: throws', () => {
    expect(() => getPriceBands('JPY')).toThrow(/JPY/);
  });
});
