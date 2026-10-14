/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { CSV_MAX_ROWS, CsvError, parseCsv } from './csv';

describe('csv parser', () => {
  it('reads quotes, embedded commas and newlines', () => {
    const parsed = parseCsv('sku,name.en-US,description.en-US\nAB-1,"Pad, front","Line one\nline ""two"""\n');
    expect(parsed.headers).toEqual(['sku', 'name.en-US', 'description.en-US']);
    expect(parsed.rows).toEqual([['AB-1', 'Pad, front', 'Line one\nline "two"']]);
  });
  it('strips a BOM and handles CRLF', () => {
    const parsed = parseCsv('﻿sku,price\r\nAB-1,1.00\r\nAB-2,2.00\r\n');
    expect(parsed.headers).toEqual(['sku', 'price']);
    expect(parsed.rows).toEqual([['AB-1', '1.00'], ['AB-2', '2.00']]);
  });
  it('pads short rows, skips blank lines and keeps empty cells', () => {
    expect(parseCsv('a,b,c\n1,,\n\n2\n').rows).toEqual([['1', '', ''], ['2', '', '']]);
  });
  it('enforces the row limit and refuses an unterminated quote or an empty file', () => {
    const big = `a\n${Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `r${i}`).join('\n')}`;
    expect(() => parseCsv(big)).toThrow(CsvError);
    expect(() => parseCsv('a\n"open')).toThrow(/not closed/);
    expect(() => parseCsv('')).toThrow(/empty/);
    expect(parseCsv(`a\n${Array.from({ length: CSV_MAX_ROWS }, (_, i) => `r${i}`).join('\n')}`).rows).toHaveLength(CSV_MAX_ROWS);
  });
  it('enforces the 1 MB limit', () => {
    expect(() => parseCsv(`a\n${'x'.repeat(1_000_001)}`)).toThrow(/1 MB/);
  });
});
