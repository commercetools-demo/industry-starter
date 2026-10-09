/**
 * A minimal one-page PDF writer (built-in Helvetica, text only) so downloads need no dependency. Input is printable
 * Latin-1 text; anything else is replaced by "?".
 */
const esc = (s: string) => s.replace(/[^\x20-\x7E]/g, (c) => (c.charCodeAt(0) <= 0xff && c.charCodeAt(0) >= 0xa0 ? c : '?')).replace(/([\\()])/g, '\\$1');

export interface PdfLine { text: string; size?: number; bold?: boolean }

export function buildPdf(title: string, lines: PdfLine[]): Uint8Array {
  const content: string[] = ['BT', '56 780 Td', '/F2 20 Tf', `(${esc(title)}) Tj`, 'ET'];
  let y = 740;
  for (const l of lines) {
    const size = l.size ?? 12;
    content.push('BT', `56 ${y} Td`, `/${l.bold ? 'F2' : 'F1'} ${size} Tf`, `(${esc(l.text)}) Tj`, 'ET');
    y -= size + 10;
  }
  const stream = content.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
}
