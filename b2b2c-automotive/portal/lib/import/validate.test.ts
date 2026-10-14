/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { FITMENT_WARNING } from './columns';
import { parseCsv } from './csv';
import { collectSkus, localProductKey, validateImport, type ValidateContext } from './validate';

const HEADER = 'sku,name.en-US,name.de-DE,slug.en-US,price,categories,fitment';
const ctx: ValidateContext = { storeKey: 'store-a', categoryKeys: new Set(['mau-cat-brakes', 'mau-cat-filters']), existingSkus: new Set(['TST-W-EXIST']), existingKeys: new Set() };

/** 120 rows: 112 clean, 6 with a default used (empty German name), 2 errors (bad price, unknown category). */
function fixture(): string {
  const lines = [HEADER];
  for (let i = 1; i <= 112; i += 1) lines.push(`TST-W-${String(i).padStart(3, '0')},Part ${i},Teil ${i},part-${i},${i}.50,mau-cat-brakes,`);
  for (let i = 113; i <= 118; i += 1) lines.push(`TST-W-${i},Part ${i},,part-${i},9.90,mau-cat-filters,`);
  lines.push('TST-W-119,Part 119,Teil 119,part-119,abc,mau-cat-brakes,');
  lines.push('TST-W-120,Part 120,Teil 120,part-120,5.00,mau-cat-unknown,');
  return lines.join('\n');
}

describe('csv validate 120 rows', () => {
  const result = validateImport(parseCsv(fixture()), ctx);
  it('112 valid, 6 warnings and 2 errors', () => {
    expect([result.rows, result.valid, result.warnings, result.errors]).toEqual([120, 112, 6, 2]);
    expect(result.importable).toBe(118);
    expect(result.items).toHaveLength(118);
  });
  it('lists errors with row, column and reason and the effect', () => {
    const errors = result.issues.filter((i) => i.effect === 'Skipped');
    expect(errors).toEqual([
      { row: 120, column: 'price', message: 'The price must be above zero with a point and at most two decimals', effect: 'Skipped' },
      { row: 121, column: 'categories', message: 'Unknown category mau-cat-unknown', effect: 'Skipped' },
    ]);
    expect(result.issues.filter((i) => i.effect === 'Default used')).toHaveLength(6);
  });
  it('the fitment column is Unmapped with the warning', () => {
    expect(result.mapping.find((m) => m.header === 'fitment')).toEqual({ header: 'fitment', target: null, warning: FITMENT_WARNING });
    expect(result.mapping.filter((m) => m.target === null)).toHaveLength(1);
  });
});

describe('csv validate rules', () => {
  const run = (rows: string[], extra: Partial<ValidateContext> = {}) => validateImport(parseCsv([HEADER, ...rows].join('\n')), { ...ctx, ...extra });
  it('skips a duplicate SKU in the file, in the project, a reserved SKU and a missing field', () => {
    const r = run(['AAA-1,Part A,Teil A,a,1.00,mau-cat-brakes,', 'AAA-1,Part B,Teil B,b,1.00,mau-cat-brakes,', 'TST-W-EXIST,Part C,Teil C,c,1.00,mau-cat-brakes,', 'MLV-X-1,Part D,Teil D,d,1.00,mau-cat-brakes,', ',Part E,Teil E,e,1.00,mau-cat-brakes,', 'EEE-1,,,f,1.00,mau-cat-brakes,', 'FFF-1,Part F,Teil F,f,0,mau-cat-brakes,']);
    expect(r.valid).toBe(1);
    expect(r.errors).toBe(6);
    expect(r.issues.map((i) => i.message)).toEqual([
      'The SKU appears twice in the file',
      'SKU already in use',
      'The SKU is not valid (3 to 40 capital letters, digits, dots, dashes or underscores; MLV- is reserved)',
      'The SKU is missing',
      'The name is missing',
      'The price must be above zero with a point and at most two decimals',
    ]);
  });
  it('a price of 0 or a comma is refused, any price above zero is accepted (no floor)', () => {
    expect(run(['AAA-1,Part A,Teil A,a,0.01,mau-cat-brakes,']).valid).toBe(1);
    expect(run(['AAA-1,Part A,Teil A,a,"12,50",mau-cat-brakes,']).errors).toBe(1);
  });
  it('keeps a formula-looking cell as text with a warning, and a missing slug is derived', () => {
    const r = run(['AAA-1,=SUM(A1),Teil A,,5.00,mau-cat-brakes,']);
    expect(r.warnings).toBe(1);
    expect(r.items[0].name['en-US']).toBe('=SUM(A1)');
    expect(r.items[0].slug['en-US']).toBe('sum-a1-aaa-1');
    expect(r.issues.map((i) => i.effect)).toEqual(['Default used', 'Default used']);
  });
  it('refuses an existing product key and builds the key from the store and SKU', () => {
    expect(localProductKey('Store-A', 'AB.1')).toBe('local-store-a-ab-1');
    expect(run(['AAA-1,Part A,Teil A,a,5.00,mau-cat-brakes,'], { existingKeys: new Set(['local-store-a-aaa-1']) }).errors).toBe(1);
  });
  it('only mau-pt-local-part is a supported product type', () => {
    const r = validateImport(parseCsv('sku,name.en-US,price,categories,productType\nAAA-1,Part A,5.00,mau-cat-brakes,mau-pt-part'), ctx);
    expect(r.errors).toBe(1);
  });
  it('collects the SKUs of the file for the project lookup', () => {
    expect(collectSkus(parseCsv(fixture())).slice(0, 2)).toEqual(['TST-W-001', 'TST-W-002']);
  });
});
