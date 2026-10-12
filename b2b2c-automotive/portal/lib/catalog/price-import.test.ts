import { describe, expect, it } from 'vitest';
import { parsePriceCsv } from './price-import';

describe('parsePriceCsv', () => {
  it('reads sku;price with decimal commas and sku,price with dots, skipping a header', () => {
    expect(parsePriceCsv('sku;price\nMLV-BP-41001;90,50\nMLV-OF-44001;12.9\n')).toEqual({
      rows: [{ sku: 'MLV-BP-41001', centAmount: 9050 }, { sku: 'MLV-OF-44001', centAmount: 1290 }],
      problems: [],
    });
    expect(parsePriceCsv('MLV-BP-41001,90.5\r\nMLV-OF-44001,13').rows).toEqual([{ sku: 'MLV-BP-41001', centAmount: 9050 }, { sku: 'MLV-OF-44001', centAmount: 1300 }]);
  });

  it('reports bad rows with their line number and keeps the good ones', () => {
    const { rows, problems } = parsePriceCsv('A-1;10\nA-2;abc\nA-1;11\n;5\nA-3;1.234\nA-4;5;extra');
    expect(rows).toEqual([{ sku: 'A-1', centAmount: 1000 }]);
    expect(problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 6]);
  });

  it('allows zero in the parser (the server refuses it) but not a missing price', () => {
    expect(parsePriceCsv('A-1;0').rows).toEqual([{ sku: 'A-1', centAmount: 0 }]);
    expect(parsePriceCsv('A-1;').problems).toHaveLength(1);
  });

  it('refuses more than 2000 rows', () => {
    const csv = Array.from({ length: 2001 }, (_, i) => `S-${i};1`).join('\n');
    expect(parsePriceCsv(csv).problems[0]?.message).toContain('2000');
  });
});
