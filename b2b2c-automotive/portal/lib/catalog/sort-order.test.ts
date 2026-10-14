/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { allocateSortOrder, inBand, rankToSortOrders, SORT_HIGHER_FIRST } from './sort-order';

describe('sortOrder', () => {
  it('a higher value fires first (direction confirmed from the commercetools documentation)', () => {
    expect(SORT_HIGHER_FIRST).toBe(true);
  });

  it('allocated values are unique, inside 0.05 to 0.89, never end in 0; malva-funded band is 0.90 to 0.99', () => {
    const held = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const v = allocateSortOrder('product', held, 'reseller');
      expect(held.has(v)).toBe(false);
      held.add(v);
      expect(Number(v)).toBeGreaterThanOrEqual(0.05);
      expect(Number(v)).toBeLessThanOrEqual(0.89);
      expect(v.endsWith('0')).toBe(false);
      expect(v).toMatch(/^0\.\d{10}$/);
    }
    for (let i = 0; i < 100; i += 1) {
      const v = allocateSortOrder('cart', held, 'malva-funded');
      held.add(v);
      expect(Number(v)).toBeGreaterThanOrEqual(0.9);
      expect(Number(v)).toBeLessThanOrEqual(0.99);
      expect(v.endsWith('0')).toBe(false);
    }
  });

  it('retries on a collision', () => {
    const first = allocateSortOrder('product', new Set(), 'reseller', { random: () => 0.5 });
    const next = allocateSortOrder('product', new Set([first]), 'reseller', { random: (() => { let n = 0; return () => (n++ === 0 ? 0.5 : 0.25); })() });
    expect(next).not.toBe(first);
  });

  it('mirrors the bands when the platform ranks the other way', () => {
    const v = allocateSortOrder('product', new Set(), 'malva-funded', { higherFirst: false });
    expect(Number(v)).toBeLessThanOrEqual(0.1);
    expect(inBand(v, 'malva-funded', false)).toBe(true);
    expect(inBand('0.91', 'malva-funded')).toBe(true);
    expect(inBand('0.51', 'reseller')).toBe(true);
    expect(inBand('0.91', 'reseller')).toBe(false);
  });

  it('rank 1 gets the highest value and values are a permutation of the originals', () => {
    const current = new Map([['a', '0.5100000001'], ['b', '0.5200000001'], ['c', '0.5300000001']]);
    const next = rankToSortOrders(['c', 'a', 'b'], current);
    expect(next.get('c')).toBe('0.5300000001');
    expect(next.get('a')).toBe('0.5200000001');
    expect(next.get('b')).toBe('0.5100000001');
    expect([...next.values()].sort()).toEqual([...current.values()].sort());
    const flipped = rankToSortOrders(['c', 'a', 'b'], current, { higherFirst: false });
    expect(flipped.get('c')).toBe('0.5100000001');
  });

  it('compares values of different length numerically', () => {
    const next = rankToSortOrders(['x', 'y'], new Map([['x', '0.51'], ['y', '0.5123456781']]));
    expect(next.get('x')).toBe('0.5123456781');
  });
});
