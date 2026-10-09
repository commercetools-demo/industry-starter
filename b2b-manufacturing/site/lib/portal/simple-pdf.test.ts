import { describe, expect, it } from 'vitest';
import { fileName } from './documents';
import { buildPdf } from './simple-pdf';

describe('malva-client-portal › Download a note (file)', () => {
  it('writes a valid single page PDF with the text escaped and a correct xref offset', () => {
    const text = Buffer.from(buildPdf('Title (x)', [{ text: 'Number: A\\B (1) ü €' }])).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('(Title \\(x\\)) Tj');
    expect(text).toContain('Number: A\\\\B \\(1\\) \xfc ?');
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...text.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + 7)).toBe(`${i + 1} 0 obj`));
    const len = Number(/\/Length (\d+)/.exec(text)![1]);
    const start = text.indexOf('stream\n') + 7;
    expect(text.slice(start + len, start + len + 10)).toBe('\nendstream');
  });
  it('file names carry type, number and date and cannot contain path characters', () => {
    expect(fileName('invoice', 'MPW-INV-3000', '2026-05-01')).toBe('invoice-MPW-INV-3000-2026-05-01.pdf');
    expect(fileName('a/b', '../x y"', '2026-05-01T10:00')).toBe('a-b-x-y-2026-05-01.pdf');
  });
});
