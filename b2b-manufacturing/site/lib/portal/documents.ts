import type { Invoice, Visit, WasteDocument } from './data-source';
import { buildPdf, type PdfLine } from './simple-pdf';

/** URL segment of each waste document kind (`/api/portal/documents/[type]/[id]`). */
export const DOC_TYPE = { 'Transfer note': 'transfer-note', 'Consignment note': 'consignment-note', 'Annual report': 'annual-report' } as const satisfies Record<WasteDocument['kind'], string>;
export const DOC_TYPES: readonly string[] = Object.values(DOC_TYPE);

const part = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
/** `<type>-<number>-<yyyy-mm-dd>.pdf` */
export const fileName = (type: string, number: string, date: string): string => `${part(type)}-${part(number)}-${date.slice(0, 10)}.pdf`;

const iso = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const DEMO = 'Demo data - not a real document.';

export function wasteDocPdf(d: WasteDocument): Uint8Array {
  const lines: PdfLine[] = [
    { text: `Number: ${d.number}`, bold: true }, { text: `Date: ${iso(d.date)}` }, { text: `Site: ${d.siteName}` }, { text: `Waste type: ${d.wasteType}` },
  ];
  if (d.totalKg !== undefined) lines.push({ text: `Total weight: ${d.totalKg} kg` }, { text: `Recycled weight: ${d.recycledKg ?? 0} kg` });
  lines.push({ text: DEMO, size: 10 });
  return buildPdf(`Malva - ${d.kind}`, lines);
}
export const visitPdf = (v: Visit): Uint8Array => buildPdf('Malva - Service visit report', [
  { text: `Report number: ${v.reportNumber ?? v.id}`, bold: true }, { text: `Date: ${iso(v.date)}` }, { text: `Site: ${v.siteName}` }, { text: `Service: ${v.service}` }, { text: `Status: ${v.status}` }, { text: DEMO, size: 10 },
]);
export const invoicePdf = (i: Invoice): Uint8Array => buildPdf('Malva - Invoice', [
  { text: `Invoice number: ${i.number}`, bold: true }, { text: `Date: ${iso(i.date)}` }, { text: `Site: ${i.siteName}` },
  { text: `Amount: ${(i.amountCents / 100).toFixed(2)} ${i.currency}` }, { text: `Status: ${i.status}` }, { text: DEMO, size: 10 },
]);
