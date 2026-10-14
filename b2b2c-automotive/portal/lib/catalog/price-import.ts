// CSV of price changes: `sku;price` or `sku,price` (T-06). Prices are written with a dot, or with a comma when the separator is
// a semicolon, and at most two decimals. At most 2000 rows; a header line is skipped. Pure.
export const MAX_IMPORT_ROWS = 2000;

export interface CsvPriceRow {
  sku: string;
  centAmount: number;
}
export interface CsvProblem {
  line: number;
  message: string;
}

const SKU = /^[A-Za-z0-9_-]{1,100}$/;

export function parsePriceCsv(text: string): { rows: CsvPriceRow[]; problems: CsvProblem[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const first = lines.find((l) => l.trim());
  const delimiter = first?.includes(';') ? ';' : ',';
  const rows: CsvPriceRow[] = [];
  const problems: CsvProblem[] = [];
  const seen = new Set<string>();
  let headerSkipped = false;
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const [skuRaw = '', priceRaw = '', ...rest] = line.split(delimiter).map((s) => s.trim().replace(/^"|"$/g, ''));
    const number = delimiter === ';' ? priceRaw.replace(',', '.') : priceRaw;
    if (!headerSkipped && rows.length === 0 && problems.length === 0 && !/^\d/.test(number) && /^(sku|part|artikel)/i.test(skuRaw)) {
      headerSkipped = true;
      return;
    }
    if (rest.length) return void problems.push({ line: index + 1, message: 'Use two columns: sku and price' });
    if (!SKU.test(skuRaw)) return void problems.push({ line: index + 1, message: 'Invalid part number' });
    if (seen.has(skuRaw)) return void problems.push({ line: index + 1, message: 'Part number appears twice' });
    if (!/^\d+(\.\d{1,2})?$/.test(number)) return void problems.push({ line: index + 1, message: 'Enter a price with at most two decimals' });
    seen.add(skuRaw);
    rows.push({ sku: skuRaw, centAmount: Math.round(Number(number) * 100) });
  });
  if (rows.length + problems.length > MAX_IMPORT_ROWS) return { rows: [], problems: [{ line: 0, message: `At most ${MAX_IMPORT_ROWS} rows` }] };
  return { rows, problems };
}
