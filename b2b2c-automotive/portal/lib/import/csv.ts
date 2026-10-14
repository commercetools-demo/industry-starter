// RFC 4180 CSV parser for the product import (W-13). Pure. Handles quotes, embedded commas and newlines, a BOM and CRLF. Limits:
// 1 MB and 2,000 data rows. Nothing is ever evaluated: cells are plain strings.
export const CSV_MAX_BYTES = 1_000_000;
export const CSV_MAX_ROWS = 2000;

export class CsvError extends Error {
  constructor(
    public code: 'TOO_LARGE' | 'TOO_MANY_ROWS' | 'EMPTY' | 'UNTERMINATED_QUOTE' | 'NO_HEADER',
    message: string,
  ) {
    super(message);
    this.name = 'CsvError';
  }
}

export interface ParsedCsv {
  headers: string[];
  /** Data rows, each as long as the header row (short rows are padded with empty strings). */
  rows: string[][];
}

/** Splits text into records of cells. Blank lines are skipped. */
function records(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let touched = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (touched || row.some((c) => c !== '')) out.push(row);
    row = [];
    touched = false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      touched = true;
    } else if (ch === ',') {
      endCell();
      touched = true;
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
    } else if (ch === '\n') endRow();
    else {
      cell += ch;
      touched = true;
    }
  }
  if (quoted) throw new CsvError('UNTERMINATED_QUOTE', 'A quoted cell is not closed');
  if (cell !== '' || row.length > 0) endRow();
  return out;
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) throw new CsvError('TOO_LARGE', 'The file is larger than 1 MB');
  const all = records(text);
  if (all.length === 0) throw new CsvError('EMPTY', 'The file is empty');
  const headers = all[0].map((h) => h.trim());
  if (headers.every((h) => h === '')) throw new CsvError('NO_HEADER', 'The first row must name the columns');
  const data = all.slice(1);
  if (data.length > CSV_MAX_ROWS) throw new CsvError('TOO_MANY_ROWS', 'The file has more than 2,000 rows');
  const rows = data.map((r) => headers.map((_, i) => r[i] ?? ''));
  return { headers, rows };
}
