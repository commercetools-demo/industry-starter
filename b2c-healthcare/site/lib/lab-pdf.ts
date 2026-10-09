import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { LabDetailView } from '@/lib/account-types';
import { rangeLabel } from '@/lib/labs';

/**
 * Simple server-side lab results PDF (pdf-lib, no external service). Pure: bytes in, bytes out, nothing logged.
 * The document holds health data, so it is only ever produced for the signed-in patient's own test and sent `no-store`.
 */

export interface LabPdfLabels {
  heading: string;
  collected: string;
  orderedBy: string;
  laboratory: string;
  note: string;
  colTest: string;
  colResult: string;
  colRange: string;
  colFlag: string;
  flags: { normal: string; high: string; low: string };
  footer: string;
}

const PAGE = { width: 612, height: 792 };
const MARGIN = 54;
const NAVY = rgb(0.06, 0.13, 0.27);
const MUTED = rgb(0.38, 0.42, 0.5);
const DANGER = rgb(0.72, 0.11, 0.11);
const COLUMNS = [0, 190, 290, 450].map((x) => MARGIN + x);

/** Replaces what the standard font cannot encode (it only covers WinAnsi) so a stray character never fails the download. */
function safe(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/[\r\n\t]+/g, ' '))
    .map((ch) => (supported.has(ch.codePointAt(0) ?? 0) ? ch : '?'))
    .join('');
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of safe(font, text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildLabPdf(lab: LabDetailView, labels: LabPdfLabels, collectedText: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(lab.name);
  doc.setProducer('Malva Healthcare');
  doc.setCreator('Malva Healthcare');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const text = (value: string, x: number, size: number, font: PDFFont = regular, color = NAVY) =>
    page.drawText(safe(font, value), { x, y, size, font, color });
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  text(labels.heading, MARGIN, 11, bold, MUTED);
  y -= 26;
  text(lab.name, MARGIN, 20, bold);
  y -= 26;
  const facts: Array<[string, string]> = [
    [labels.collected, collectedText],
    ...(lab.orderedByName ? ([[labels.orderedBy, lab.orderedByName]] as Array<[string, string]>) : []),
    [labels.laboratory, lab.laboratory],
  ];
  for (const [name, value] of facts) {
    text(name, MARGIN, 10, regular, MUTED);
    text(value, MARGIN + 110, 10);
    y -= 16;
  }
  y -= 8;
  text(labels.note, MARGIN, 10, bold, MUTED);
  y -= 15;
  for (const line of wrap(regular, lab.note, 10, PAGE.width - 2 * MARGIN)) {
    ensure(14);
    text(line, MARGIN, 10);
    y -= 14;
  }
  y -= 14;

  const header = [labels.colTest, labels.colResult, labels.colRange, labels.colFlag];
  header.forEach((name, i) => text(name, COLUMNS[i], 10, bold, MUTED));
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.7, color: MUTED });
  y -= 16;
  for (const r of lab.results) {
    ensure(20);
    const out = r.flag !== 'normal';
    text(r.name, COLUMNS[0], 10);
    text(`${r.value} ${r.unit}`.trim(), COLUMNS[1], 10, bold);
    text(rangeLabel(r.low, r.high, r.unit), COLUMNS[2], 10, regular, MUTED);
    text(labels.flags[r.flag], COLUMNS[3], 10, out ? bold : regular, out ? DANGER : NAVY);
    y -= 20;
  }

  for (const p of doc.getPages()) {
    p.drawText(safe(regular, labels.footer), { x: MARGIN, y: MARGIN - 20, size: 8, font: regular, color: MUTED });
  }
  return doc.save();
}
