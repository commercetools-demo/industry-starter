// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { FIRST_SKU, htmlToText, reduceDrinks, type SourceRow } from '../scripts/reduce-drinks';

const row = (name: string, size: string, url: string, extra: Partial<SourceRow> = {}): SourceRow =>
  ({ category: 'Chic', name, size, description: '<ul><li><div style="x:1">Crisp &amp; fresh</div></li></ul>', Image_URL: url, ...extra });

describe('reduceDrinks', () => {
  const rows: SourceRow[] = [
    row('Lime', '16.9 fl oz', 'u1'), row('Lime', '16.9 fl oz', 'u2'), row('Lime', '16.9 fl oz', 'u1'),
    row('Lime', '24 pack', 'u3'), row('Plain', '4 pack', ''),
    { category: '', name: 'Browse products', size: '', description: '', Image_URL: '' },
  ];

  it('makes one line per distinct (name, size) with distinct non-empty images in order', () => {
    const { lines, rowsDropped, withoutImages } = reduceDrinks(rows);
    expect(lines.map((l) => [l.name, l.size, l.images])).toEqual([
      ['Lime', '16.9 fl oz', ['u1', 'u2']], ['Lime', '24 pack', ['u3']], ['Plain', '4 pack', []],
    ]);
    expect(rowsDropped).toBe(1);
    expect(withoutImages).toBe(1);
  });

  it('gives number-only sequential skus and no combined key field', () => {
    const { lines } = reduceDrinks(rows);
    expect(lines.map((l) => l.sku)).toEqual([String(FIRST_SKU), String(FIRST_SKU + 1), String(FIRST_SKU + 2)]);
    for (const l of lines) {
      expect(l.sku).toMatch(/^\d+$/);
      expect(Object.keys(l).sort()).toEqual(['category', 'description', 'images', 'name', 'size', 'sku']);
    }
  });

  it('is deterministic', () => {
    expect(reduceDrinks(rows)).toEqual(reduceDrinks(rows));
  });

  it('reduces html to plain text', () => {
    expect(htmlToText('<ul><li><div style="a:b">One &amp; two</div></li><li>Three</li></ul>')).toBe('One & two\n\nThree');
  });
});
